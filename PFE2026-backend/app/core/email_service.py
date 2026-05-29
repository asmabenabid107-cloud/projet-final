import random
import smtplib
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.core.config import settings

# -----------------------
# OTP storage (in-memory)
# -----------------------
otp_storage = {}


def generate_otp() -> str:
    return str(random.randint(100000, 999999))


def store_otp(key: str, otp: str, expiry_minutes: int = 10):
    expiry = datetime.now() + timedelta(minutes=expiry_minutes)
    otp_storage[key] = {"otp": otp, "expiry": expiry}
    print(f"OTP généré pour {key} : {otp}")


def verify_otp(key: str, otp_code: str) -> bool:
    if key not in otp_storage:
        return False

    stored = otp_storage[key]

    if datetime.now() > stored["expiry"]:
        del otp_storage[key]
        return False

    return stored["otp"] == otp_code


# -----------------------
# Email sender (HTML)
# -----------------------
def _send_html_email(to_email: str, subject: str, html: str) -> bool:
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.MAIL_USERNAME
        msg["To"] = to_email

        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT) as server:
            if str(settings.MAIL_STARTTLS).lower() == "true":
                server.starttls()
            server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
            server.sendmail(settings.MAIL_USERNAME, to_email, msg.as_string())

        print(f"✅ Email envoyé à {to_email}")
        return True

    except Exception as e:
        print(f"❌ Erreur envoi email: {e}")
        return False


# -----------------------
# Forgot password OTP email
# -----------------------
def send_otp_email(to_email: str, otp: str) -> bool:
    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px; background: #f0f0f0;">
        <div style="max-width: 500px; margin: 0 auto; background: white;
                    padding: 30px; border-radius: 10px;">
            <h2 style="text-align:center;">🔐 MZ Logistic</h2>
            <p>Votre code de vérification est :</p>
            <div style="background:#007bff;color:white;font-size:32px;
                        text-align:center;padding:20px;border-radius:8px;
                        letter-spacing:8px;">
                {otp}
            </div>
            <p>Ce code expire dans 10 minutes.</p>
        </div>
    </body>
    </html>
    """
    return _send_html_email(to_email, "Code de réinitialisation - MZ Logistic", html)


def send_password_reset_otp(email: str) -> str:
    otp = generate_otp()
    store_otp(email, otp)
    send_otp_email(email, otp)
    return otp


# -----------------------
# Account approved emails
# -----------------------
def send_shipper_approved_email(to_email: str, name: str | None = None) -> bool:
    who = f"<b>{name}</b>, " if name else ""
    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px; background: #f0f0f0;">
        <div style="max-width: 560px; margin: 0 auto; background: white;
                    padding: 28px; border-radius: 12px;">
            <h2 style="margin:0; text-align:center;">MZ Logistic</h2>
            <p style="margin-top:18px;">{who}votre compte <b>Expéditeur</b> a été <b>approuvé</b>.</p>
            <p>Vous pouvez maintenant vous connecter et accéder à votre dashboard.</p>
            <div style="margin-top:18px; padding:14px; border-radius:10px; background:#f6f8ff; border:1px solid #dfe6ff;">
                Utilisez votre email et votre mot de passe pour vous connecter.
            </div>
            <p style="margin-top:18px; opacity:.7; font-size:13px;">
                Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.
            </p>
        </div>
    </body>
    </html>
    """
    return _send_html_email(to_email, "Compte Expéditeur approuvé - MZ Logistic", html)


def send_courier_approved_email(to_email: str, name: str | None = None) -> bool:
    who = f"<b>{name}</b>, " if name else ""
    html = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px; background: #f0f0f0;">
        <div style="max-width: 560px; margin: 0 auto; background: white;
                    padding: 28px; border-radius: 12px;">
            <h2 style="margin:0; text-align:center;">MZ Logistic</h2>
            <p style="margin-top:18px;">{who}votre compte <b>Livreur</b> a été <b>approuvé</b>.</p>
            <p>Vous pouvez maintenant vous connecter et accéder à votre dashboard.</p>
            <div style="margin-top:18px; padding:14px; border-radius:10px; background:#f6f8ff; border:1px solid #dfe6ff;">
                Utilisez votre email et votre mot de passe pour vous connecter.
            </div>
            <p style="margin-top:18px; opacity:.7; font-size:13px;">
                Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.
            </p>
        </div>
    </body>
    </html>
    """
    return _send_html_email(to_email, "Compte Livreur approuvé - MZ Logistic", html)


# -----------------------
# ✅ Alias attendu par auth.py
# -----------------------
def send_account_approved_email(to_email: str, role_label: str, name: str | None = None) -> bool:
    r = (role_label or "").strip().lower()
    if r in ["courier", "livreur"]:
        return send_courier_approved_email(to_email, name)
    return send_shipper_approved_email(to_email, name)

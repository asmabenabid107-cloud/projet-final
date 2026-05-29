import random
import string


def generate_tracking_number() -> str:
    return "MZ-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=10))


def generate_barcode_value() -> str:
    return "".join(random.choices(string.digits, k=12))

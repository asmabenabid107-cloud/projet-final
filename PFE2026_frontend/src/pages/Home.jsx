import { createElement, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowUpRight,
  Boxes,
  ChevronRight,
  MapPinned,
  PackageCheck,
  Radar,
  Route,
  ShieldCheck,
  Truck,
  Warehouse,
} from "lucide-react";
import * as THREE from "three";

import ThemeToggleButton from "../components/ThemeToggleButton.jsx";

const navItems = [
  { label: "Experience", target: "experience" },
  { label: "Reseau", target: "network" },
  { label: "Pilotage", target: "control" },
  { label: "Contact", target: "contact" },
];

const proofItems = [
  { label: "Depots connectes", value: "2", detail: "Kairouan et Sousse" },
  { label: "Flux colis", value: "5K+", detail: "operations pilotees" },
  { label: "Fenetre decision", value: "Live", detail: "statuts et alertes" },
];

const roadStats = [
  { label: "Depart depot", value: "07:30" },
  { label: "Route active", value: "Sousse" },
  { label: "Preuve client", value: "scan" },
];

const routeMoments = [
  {
    step: "01",
    title: "La route devient visible",
    text: "Video terrain, depots et statuts racontent le meme mouvement, sans multiplier les ecrans.",
  },
  {
    step: "02",
    title: "Chaque colis garde son rythme",
    text: "Creation, tri, sortie, livraison: le visiteur comprend la promesse avant meme de se connecter.",
  },
  {
    step: "03",
    title: "Le reseau parait vivant",
    text: "Kairouan, Sousse, livreurs et expediteurs avancent comme une seule operation.",
  },
];

const operationCards = [
  {
    icon: PackageCheck,
    title: "Colis lisibles",
    text: "Chaque expedition garde son numero, son statut, son depot et sa prochaine action dans un flux clair.",
  },
  {
    icon: Route,
    title: "Tournees orchestrees",
    text: "Les departs, retours et relais livreurs deviennent une sequence visible au lieu d'une pile d'appels.",
  },
  {
    icon: Radar,
    title: "Signaux prioritaires",
    text: "Les colis a reprendre, relivrer ou controler remontent vite, avant que la journee ne se bloque.",
  },
  {
    icon: ShieldCheck,
    title: "Confiance client",
    text: "Les expediteurs suivent le rythme du reseau et les destinataires recoivent des informations propres.",
  },
];

const depotSignals = [
  { depot: "Kairouan", role: "Base centre", tone: "blue", value: "hub" },
  { depot: "Sousse", role: "Base Sahel", tone: "cyan", value: "hub" },
  { depot: "Livreurs", role: "Terrain mobile", tone: "green", value: "scan" },
  { depot: "Expediteurs", role: "Creation colis", tone: "amber", value: "flux" },
];

function useLandingMotion(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reveals = Array.from(root.querySelectorAll(".mzReveal"));

    if (reduceMotion) {
      reveals.forEach((item) => item.classList.add("isVisible"));
      return undefined;
    }

    gsap.registerPlugin(ScrollTrigger);

    const context = gsap.context(() => {
      gsap.set(".mzReveal", { autoAlpha: 0, y: 48 });

      gsap.utils.toArray(".mzReveal").forEach((item, index) => {
        gsap.to(item, {
          autoAlpha: 1,
          y: 0,
          duration: 0.9,
          delay: (index % 3) * 0.045,
          ease: "expo.out",
          scrollTrigger: {
            trigger: item,
            start: "top 84%",
            once: true,
          },
        });
      });

      gsap.to(".mzHeroCopy", {
        yPercent: -5,
        opacity: 0.82,
        ease: "none",
        scrollTrigger: {
          trigger: ".mzHero",
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });

      gsap.to(".mzTheatreShell", {
        yPercent: 5,
        ease: "none",
        scrollTrigger: {
          trigger: ".mzHero",
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });

      gsap.utils.toArray(".mzStackCard").forEach((card, index) => {
        gsap.fromTo(
          card,
          { autoAlpha: 0, y: 62 + index * 10, rotate: index % 2 === 0 ? -1.4 : 1.4 },
          {
            autoAlpha: 1,
            y: 0,
            rotate: 0,
            duration: 0.95,
            ease: "power4.out",
            scrollTrigger: {
              trigger: card,
              start: "top 82%",
              once: true,
            },
          },
        );
      });

      gsap.utils.toArray(".mzReelFrame").forEach((frame) => {
        gsap.fromTo(
          frame,
          { autoAlpha: 0.52, scale: 0.96 },
          {
            autoAlpha: 1,
            scale: 1,
            ease: "none",
            scrollTrigger: {
              trigger: frame,
              start: "top 88%",
              end: "bottom 30%",
              scrub: true,
            },
          },
        );
      });
    }, root);

    return () => context.revert();
  }, [rootRef]);
}

function useHeroBlendOnScroll(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    let frameId = 0;

    const updateBlend = () => {
      frameId = 0;
      root.classList.toggle("isHeroBlendVisible", window.scrollY > 24);
    };

    const requestBlendUpdate = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(updateBlend);
    };

    updateBlend();
    window.addEventListener("scroll", requestBlendUpdate, { passive: true });
    window.addEventListener("resize", requestBlendUpdate);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", requestBlendUpdate);
      window.removeEventListener("resize", requestBlendUpdate);
      root.classList.remove("isHeroBlendVisible");
    };
  }, [rootRef]);
}

function RouteTheatre() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return undefined;

    let renderer;
    let frameId;
    let disposed = false;
    const pointer = { x: 0, y: 0 };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch (error) {
      console.error(error);
      return undefined;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x06101d, 12, 34);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
    camera.position.set(0.8, 6.5, 12.8);
    camera.lookAt(0.35, 0, 0);

    const world = new THREE.Group();
    world.position.set(0.55, -0.42, -0.35);
    world.rotation.x = -0.2;
    world.scale.setScalar(1.16);
    scene.add(world);

    const ambient = new THREE.AmbientLight(0x99c7ff, 1.1);
    const keyLight = new THREE.PointLight(0x5eead4, 30, 24);
    keyLight.position.set(-5, 7, 5);
    const sideLight = new THREE.PointLight(0xffc15f, 12, 18);
    sideLight.position.set(6, 4, -3);
    scene.add(ambient, keyLight, sideLight);

    const grid = new THREE.GridHelper(22, 34, 0x2a9bff, 0x174159);
    grid.position.y = -0.02;
    world.add(grid);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({
        color: 0x07101d,
        roughness: 0.8,
        metalness: 0.25,
        transparent: true,
        opacity: 0.68,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.035;
    world.add(floor);

    const nodeMaterial = new THREE.MeshStandardMaterial({
      color: 0xeff6ff,
      emissive: 0x1c76ff,
      emissiveIntensity: 0.38,
      roughness: 0.34,
      metalness: 0.52,
    });
    const nodeAccent = new THREE.MeshStandardMaterial({
      color: 0x5eead4,
      emissive: 0x14b8a6,
      emissiveIntensity: 0.6,
      roughness: 0.42,
      metalness: 0.38,
    });

    const hubPositions = [
      new THREE.Vector3(-5.2, 0.22, -2.6),
      new THREE.Vector3(4.8, 0.22, -2),
      new THREE.Vector3(-2.8, 0.22, 3.8),
      new THREE.Vector3(3.1, 0.22, 3.4),
      new THREE.Vector3(0, 0.45, 0.4),
    ];
    const radarRings = [];

    hubPositions.forEach((position, index) => {
      const hub = new THREE.Mesh(
        new THREE.SphereGeometry(index === 4 ? 0.32 : 0.22, 28, 28),
        index === 4 ? nodeAccent : nodeMaterial,
      );
      hub.position.copy(position);
      world.add(hub);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(index === 4 ? 0.62 : 0.46, 0.012, 8, 42),
        new THREE.MeshBasicMaterial({
          color: index === 4 ? 0x5eead4 : 0x60a5fa,
          transparent: true,
          opacity: 0.72,
        }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.copy(position);
      ring.position.y = 0.03;
      world.add(ring);
      radarRings.push(ring);

      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(index === 4 ? 0.08 : 0.045, index === 4 ? 0.2 : 0.12, index === 4 ? 2.6 : 1.7, 24, 1, true),
        new THREE.MeshBasicMaterial({
          color: index === 4 ? 0x5eead4 : 0x60a5fa,
          transparent: true,
          opacity: index === 4 ? 0.22 : 0.13,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      beam.position.copy(position);
      beam.position.y += index === 4 ? 1.42 : 0.94;
      world.add(beam);
    });

    const routes = [
      { from: hubPositions[0], to: hubPositions[4], color: 0x60a5fa, offset: 1.1 },
      { from: hubPositions[1], to: hubPositions[4], color: 0x5eead4, offset: 1.3 },
      { from: hubPositions[2], to: hubPositions[4], color: 0xfbbf24, offset: 0.95 },
      { from: hubPositions[3], to: hubPositions[4], color: 0xa78bfa, offset: 1.15 },
    ].map((route) => {
      const mid = route.from.clone().lerp(route.to, 0.5);
      mid.y += route.offset;
      const curve = new THREE.CatmullRomCurve3([route.from, mid, route.to]);
      const halo = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 68, 0.075, 10, false),
        new THREE.MeshBasicMaterial({
          color: route.color,
          transparent: true,
          opacity: 0.16,
          depthWrite: false,
        }),
      );
      const mesh = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 68, 0.034, 8, false),
        new THREE.MeshBasicMaterial({
          color: route.color,
          transparent: true,
          opacity: 0.92,
        }),
      );
      world.add(halo);
      world.add(mesh);
      return { curve, color: route.color };
    });

    const courierGeometry = new THREE.BoxGeometry(0.24, 0.16, 0.42);
    const courierMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x60a5fa,
      emissiveIntensity: 0.32,
      roughness: 0.28,
      metalness: 0.48,
    });

    const couriers = routes.map((route, index) => {
      const body = new THREE.Mesh(courierGeometry, courierMaterial);
      body.userData.progress = index * 0.18;
      body.userData.speed = 0.0016 + index * 0.00028;
      body.userData.curve = route.curve;
      world.add(body);
      return body;
    });

    const starPositions = new Float32Array(260 * 3);
    for (let index = 0; index < 260; index += 1) {
      starPositions[index * 3] = (Math.random() - 0.5) * 24;
      starPositions[index * 3 + 1] = Math.random() * 8 + 1.3;
      starPositions[index * 3 + 2] = (Math.random() - 0.5) * 18;
    }

    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: 0xbfe7ff,
        size: 0.035,
        transparent: true,
        opacity: 0.58,
      }),
    );
    scene.add(stars);

    const resize = () => {
      if (disposed) return;
      const width = Math.max(320, parent.clientWidth);
      const height = Math.max(360, parent.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const movePointer = (event) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointer.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    };

    const render = () => {
      if (disposed) return;

      world.rotation.y += reducedMotion ? 0 : 0.0014;
      world.rotation.z += (pointer.x * 0.035 - world.rotation.z) * 0.045;
      camera.position.x += (0.8 + pointer.x * 1.1 - camera.position.x) * 0.03;
      camera.position.y += (6.5 + pointer.y * -0.42 - camera.position.y) * 0.03;
      camera.lookAt(0.35, 0, 0);

      radarRings.forEach((ring, index) => {
        ring.rotation.z += reducedMotion ? 0 : 0.0022 + index * 0.00045;
        ring.scale.setScalar(1 + Math.sin(performance.now() * 0.0012 + index) * 0.045);
      });

      couriers.forEach((courier) => {
        if (!reducedMotion) {
          courier.userData.progress = (courier.userData.progress + courier.userData.speed) % 1;
        }

        const point = courier.userData.curve.getPointAt(courier.userData.progress);
        const tangent = courier.userData.curve.getTangentAt(courier.userData.progress);
        courier.position.copy(point);
        courier.lookAt(point.clone().add(tangent));
      });

      stars.rotation.y += reducedMotion ? 0 : 0.0008;
      renderer.render(scene, camera);

      if (!reducedMotion) {
        frameId = window.requestAnimationFrame(render);
      }
    };

    resize();
    render();

    window.addEventListener("resize", resize);
    canvas.addEventListener("pointermove", movePointer);

    return () => {
      disposed = true;
      if (frameId) window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointermove", movePointer);
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="mzRouteCanvas" aria-hidden="true" />;
}

function IconCard({ icon, title, text }) {
  return (
    <article className="mzBentoCard mzReveal">
      <span className="mzBentoIcon" aria-hidden="true">
        {createElement(icon, { size: 21, strokeWidth: 1.6 })}
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  useLandingMotion(rootRef);
  useHeroBlendOnScroll(rootRef);

  useEffect(() => {
    const targetId = window.location.hash.slice(1);
    if (!targetId) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ block: "start" });
        window.scrollBy(0, -96);
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="mzHome" ref={rootRef}>
      <nav className="mzNav" aria-label="Navigation accueil">
        <button className="mzBrand" type="button" onClick={() => scrollToSection("top")}>
          <span className="mzBrandMark" aria-hidden="true">MZ</span>
          <span className="mzBrandText">
            <strong>MZ Logistic</strong>
            <small>Transport + expedition</small>
          </span>
        </button>

        <div className="mzNavLinks">
          {navItems.map((item) => (
            <button key={item.target} type="button" onClick={() => scrollToSection(item.target)}>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div className="mzNavActions">
          <ThemeToggleButton compact />
          <button className="mzNavCta" type="button" onClick={() => navigate("/expediteur/register")}>
            Expedier
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </nav>

      <header className="mzHero" id="top">
        <div className="mzHeroBackdrop" aria-hidden="true">
          <RouteTheatre />
          <div className="mzHeroVectorField">
            <span className="mzTrace mzTraceOne" />
            <span className="mzTrace mzTraceTwo" />
            <span className="mzTrace mzTraceThree" />
            <span className="mzBeacon mzBeaconOne" />
            <span className="mzBeacon mzBeaconTwo" />
          </div>
        </div>

        <div className="mzHeroShade" aria-hidden="true" />

        <div className="mzHeroInner">
          <div className="mzHeroCopy">
            <p className="mzKicker">Logistique e-commerce, depots, livreurs, suivi client</p>
            <h1>MZ Logistic</h1>
            <p className="mzHeroStatement">
              Une scene de pilotage pour voir vos colis bouger, vos depots respirer et vos livreurs avancer sans bruit inutile.
            </p>

            <div className="mzHeroActions">
              <button className="mzButton mzButtonPrimary" type="button" onClick={() => navigate("/expediteur/register")}>
                Creer un compte expediteur
                <span aria-hidden="true">
                  <ArrowUpRight size={17} />
                </span>
              </button>
              <button className="mzButton mzButtonSecondary" type="button" onClick={() => navigate("/admin/login")}>
                Entrer admin
              </button>
            </div>
          </div>

          <aside className="mzTheatreShell mzReveal" aria-label="Apercu operationnel">
            <div className="mzTheatreChrome">
              <span />
              <strong>Live network</strong>
              <small>Kairouan, Sousse, terrain</small>
            </div>
            <div className="mzTheatrePanel">
              {depotSignals.map((item) => (
                <div className={`mzSignal ${item.tone}`} key={item.depot}>
                  <span>{item.depot}</span>
                  <strong>{item.value}</strong>
                  <small>{item.role}</small>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </header>

      <main className="mzMain">
        <section className="mzProofRail mzReveal" aria-label="Preuves rapides">
          {proofItems.map((item) => (
            <div className="mzProofItem" key={item.label}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
              <small>{item.detail}</small>
            </div>
          ))}
        </section>

        <section className="mzRoadStory mzReveal" id="experience" aria-label="Experience transport MZ Logistic">
          <div className="mzRoadMedia" aria-hidden="true">
            <img className="mzRoadPoster" src="/229733769-m.jpg" alt="" />
            <video className="mzRoadVideo" src="/drivingvid.mp4" autoPlay muted loop playsInline preload="metadata" />
            <div className="mzRoadScrim" />
            <div className="mzRoadLines mzRoadLinesTop" />
            <div className="mzRoadLines mzRoadLinesBottom" />
          </div>

          <div className="mzRoadContent">
            <p className="mzRoadKicker">MOVE WITH US</p>
            <h2>
              <span>Route, depot, livreur.</span>
              <strong>Ponctuels. Suivis. Livres.</strong>
            </h2>
            <button className="mzButton mzButtonSun" type="button" onClick={() => navigate("/expediteur/register")}>
              Demarrer une expedition
              <span aria-hidden="true">
                <ArrowUpRight size={17} />
              </span>
            </button>
          </div>

          <aside className="mzRoadNote">
            <span aria-hidden="true" />
            <p>
              MZ Logistic transforme la route en interface: chaque colis avance avec un statut clair, une preuve et une equipe qui sait quoi faire.
            </p>
          </aside>

          <div className="mzRoadStats" aria-label="Signaux route">
            {roadStats.map((item) => (
              <div key={item.label}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mzChapter mzRouteChapter" id="network">
          <div className="mzChapterText mzReveal">
            <p className="mzKicker">Reseau en mouvement</p>
            <h2>Une presence de marque qui sent la route, pas le template.</h2>
            <p>
              Le site garde la precision produit, mais il montre aussi la matiere: asphalte, lumiere, camions, preuves et decisions.
            </p>
          </div>

          <div className="mzRouteShowcase">
            <figure className="mzPhotoPanel mzReveal">
              <img src="/229733769-m.jpg" alt="Camions MZ Logistic sur autoroute au soleil couchant" />
              <figcaption>
                <span>Autoroute</span>
                <strong>Kairouan vers le Sahel</strong>
              </figcaption>
            </figure>

            <div className="mzBentoGrid mzRouteBento">
              {operationCards.map((item) => (
                <IconCard key={item.title} {...item} />
              ))}
            </div>
          </div>
        </section>

        <section className="mzMediaChapter mzReveal">
          <div className="mzMediaCopy">
            <p className="mzKicker">Reel terrain</p>
            <h2>Le mouvement reel donne du poids a la promesse.</h2>
            <p>
              La video de conduite installe une impression simple: ce service n'est pas abstrait, il roule, trie et livre.
            </p>
          </div>

          <div className="mzVideoBezel mzReelFrame">
            <video src="/drivingvid.mp4" autoPlay muted loop playsInline preload="metadata" />
            <div className="mzVideoOverlay">
              <span>Driving reel</span>
              <strong>Route, vitesse, confiance</strong>
            </div>
          </div>
        </section>

        <section className="mzChapter mzControlChapter" id="control">
          <div className="mzChapterText mzReveal">
            <p className="mzKicker">Pilotage quotidien</p>
            <h2>Chaque equipe voit son role sans perdre le reste du reseau.</h2>
          </div>

          <div className="mzStack">
            {routeMoments.map((item) => (
              <article className="mzStackCard" key={item.title}>
                <span>{item.step}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mzNetworkBoard mzReveal" aria-label="Reseau MZ Logistic">
          <div className="mzBoardHeader">
            <p className="mzKicker">Carte mentale du reseau</p>
            <h2>Deux depots, un flux national, une seule lecture.</h2>
          </div>

          <div className="mzBoardGrid">
            <article>
              <Warehouse size={24} strokeWidth={1.55} aria-hidden="true" />
              <span>Kairouan</span>
              <strong>Centre de gravite</strong>
            </article>
            <article>
              <MapPinned size={24} strokeWidth={1.55} aria-hidden="true" />
              <span>Sousse</span>
              <strong>Ouverture Sahel</strong>
            </article>
            <article>
              <Truck size={24} strokeWidth={1.55} aria-hidden="true" />
              <span>Terrain</span>
              <strong>Statuts livreurs</strong>
            </article>
            <article>
              <Boxes size={24} strokeWidth={1.55} aria-hidden="true" />
              <span>Expediteurs</span>
              <strong>Colis propres</strong>
            </article>
          </div>
        </section>

        <section className="mzFinalCta mzContactPanel" id="contact">
          <div className="mzFinalText mzReveal">
            <p className="mzKicker">Contact direct</p>
            <h2>Choisissez la bonne entree, le reseau fait le reste.</h2>
            <p>
              Pas de formulaire vague: chaque profil arrive sur l'espace qui lui permet d'agir vite, avec les bons controles visibles.
            </p>
          </div>

          <div className="mzContactGrid mzReveal" aria-label="Acces MZ Logistic">
            <article className="mzContactCard isPrimary">
              <span className="mzContactIcon" aria-hidden="true">
                <PackageCheck size={22} strokeWidth={1.6} />
              </span>
              <small>Expediteurs</small>
              <h3>Deposer et suivre un colis</h3>
              <p>Creation de compte, informations expediteur et suivi clair pour vos prochains bons.</p>
              <button className="mzContactButton" type="button" onClick={() => navigate("/expediteur/register")}>
                Creer un compte
                <ArrowUpRight size={16} aria-hidden="true" />
              </button>
            </article>

            <article className="mzContactCard">
              <span className="mzContactIcon" aria-hidden="true">
                <ShieldCheck size={22} strokeWidth={1.6} />
              </span>
              <small>Administration</small>
              <h3>Entrer dans la console</h3>
              <p>Controle securise des colis, comptes, depots et signaux qui demandent une decision.</p>
              <button className="mzContactButton" type="button" onClick={() => navigate("/admin/login")}>
                Connexion admin
                <ArrowUpRight size={16} aria-hidden="true" />
              </button>
            </article>

            <article className="mzContactCard">
              <span className="mzContactIcon" aria-hidden="true">
                <MapPinned size={22} strokeWidth={1.6} />
              </span>
              <small>Reseau</small>
              <h3>Kairouan, Sousse, terrain</h3>
              <p>Deux bases, une lecture operationnelle, des livreurs et expediteurs dans le meme flux.</p>
              <button className="mzContactButton" type="button" onClick={() => scrollToSection("network")}>
                Voir le reseau
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </article>
          </div>
        </section>
      </main>

      <footer className="mzFooter">
        <span>MZ Logistic</span>
        <span>{new Date().getFullYear()} Tous droits reserves</span>
      </footer>
    </div>
  );
}

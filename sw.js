const CACHE = "calendrier-v2";
const RESSOURCES = [
    "./",
    "./calendrier random.html",
    "./manifest.json",
    "./calendrier icone-512.png"
];

self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(CACHE).then(c => c.addAll(RESSOURCES)));
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then(cles =>
            Promise.all(cles.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    // Stratégie "cache d'abord" uniquement pour les ressources de l'app
    if (event.request.mode === "navigate" || RESSOURCES.includes(new URL(event.request.url).pathname)) {
        event.respondWith(
            caches.match(event.request).then(reponse =>
                reponse || fetch(event.request)
            )
        );
    }
    // Tout le reste (vos images blob:, IndexedDB...) passe normalement
});
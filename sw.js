const CACHE = "calendrier-cache";
const CACHE_INSTALLATION = "calendrier-installation";

const RESSOURCES = [
    "./",
    "./calendrier random.html",
    "./manifest.json",
    "./calendrier icone-512.png"
];

// Convertit les chemins relatifs en URL pour comparer correctement les ressources.
const URLS_RESSOURCES = RESSOURCES.map(
    ressource => new URL(ressource, self.registration.scope).pathname
);

self.addEventListener("install", event => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_INSTALLATION);

            for (const ressource of RESSOURCES) {
                const url = new URL(ressource, self.registration.scope);

                try {
                    const reponse = await fetch(url);

                    console.log(
                        "[SW] Ressource :",
                        url.href,
                        "| Statut :",
                        reponse.status
                    );

                    if (!reponse.ok) {
                        throw new Error(
                            `HTTP ${reponse.status} pour ${url.href}`
                        );
                    }

                    await cache.put(url.href, reponse);
                } catch (erreur) {
                    console.error(
                        "[SW] Échec de chargement :",
                        url.href,
                        erreur
                    );

                    throw erreur;
                }
            }

            await self.skipWaiting();
        })()
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        (async () => {
            const cacheInstallation = await caches.open(CACHE_INSTALLATION);
            const nouvellesRequetes = await cacheInstallation.keys();
            const cacheActif = await caches.open(CACHE);

            // Copie les nouvelles ressources dans le cache actif.
            for (const requete of nouvellesRequetes) {
                const reponse = await cacheInstallation.match(requete);

                if (reponse) {
                    await cacheActif.put(requete, reponse);
                }
            }

            // Supprime les anciens caches de cette application uniquement.
            const nomsCaches = await caches.keys();

            await Promise.all(
                nomsCaches
                    .filter(nom =>
                        nom.startsWith("calendrier-") &&
                        nom !== CACHE
                    )
                    .map(nom => caches.delete(nom))
            );

            await self.clients.claim();
        })()
    );
});

self.addEventListener("fetch", event => {
    const requete = event.request;

    // Ne gère que les requêtes GET.
    if (requete.method !== "GET") return;

    const url = new URL(requete.url);

    // Ignore les requêtes vers d'autres origines.
    if (url.origin !== self.location.origin) return;

    const estNavigation = requete.mode === "navigate";
    const estRessourceApplication =
        URLS_RESSOURCES.includes(url.pathname);

    // Les autres requêtes conservent leur comportement normal.
    if (!estNavigation && !estRessourceApplication) return;

    event.respondWith(
        (async () => {
            const cache = await caches.open(CACHE);

            // Priorité au réseau pour récupérer les versions à jour.
            let reponseReseau;

            try {
                reponseReseau = await fetch(requete);
            } catch (erreurReseau) {
                // Hors ligne : recherche la ressource exacte dans le cache.
                const reponseCache = await cache.match(requete);

                if (reponseCache) return reponseCache;

                // Pour une navigation, essaie la page principale du calendrier.
                if (estNavigation) {
                    const pagePrincipale = await cache.match(
                        new URL(
                            "./calendrier random.html",
                            self.registration.scope
                        ).href
                    );

                    if (pagePrincipale) return pagePrincipale;

                    const racine = await cache.match(
                        new URL(
                            "./",
                            self.registration.scope
                        ).href
                    );

                    if (racine) return racine;
                }

                // Aucune copie hors ligne disponible.
                throw erreurReseau;
            }

            // Actualise le cache si la réponse réseau est valide.
            if (reponseReseau.ok) {
                try {
                    await cache.put(
                        requete,
                        reponseReseau.clone()
                    );
                } catch (erreurCache) {
                    // Une erreur de cache ne bloque pas la réponse réseau.
                    console.warn(
                        "Impossible d'actualiser le cache du calendrier :",
                        erreurCache
                    );
                }
            }

            return reponseReseau;
        })()
    );
});

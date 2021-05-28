import type { Game } from '$lib/games';
import { build, timestamp, files } from '$service-worker';

declare const self;

const applicationCache = `applicationCache-v${timestamp}`;
const staticCache = `staticCache-v${timestamp}`;

// Caches the svelte app (not the data)
self.addEventListener('install', (event) => {
	event.waitUntil(
		Promise.all([
			caches.open(applicationCache).then((cache) => cache.addAll(build)),
			caches.open(staticCache).then((cache) => cache.addAll(files))
		]).then(self.skipWaiting())
	);
});

// Removes old caches
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) => {
			return Promise.all(
				keys.filter((key) => key !== applicationCache).map((key) => caches.delete(key))
			);
		})
	);
});

self.addEventListener('fetch', (event) => {
	const request: Request = event.request;
	const requestURL = new URL(request.url);

	if (/(games\.json)/.test(requestURL.pathname)) {
		const returnOfflineGames = () => {
			return fetch(event.request)
				.then((response) => {
					if (response.ok) return response.json();
					else throw response;
				})
				.then((games: Game[]) => {
					return Promise.all(
						games.map((game: Game) => {
							return caches
								.open('gamesCache')
								.then((cache) => {
									return cache.match(`/games/${game.slug}.json`);
								})
								.then((response: Response | undefined) => {
									if (response) game.offline = true;
									else game.offline = false;
									return game;
								});
						})
					);
				})
				.then((games) => new Response(JSON.stringify(games), { status: 200, statusText: 'ok' }))
				.catch((response) => {
					return caches
						.open('gamesCache')
						.then((cache) => cache.matchAll(`/games`))
						.then((cachesResponses) => {
							console.log(cachesResponses);
							return Promise.all(
								cachesResponses.map((response) =>
									response.json().then((game: Game) => (game.offline = true))
								)
							);
						})
						.then(
							(games) =>
								new Response(JSON.stringify(games), {
									status: response.status || 200,
									statusText: response.statusText || 'Offline'
								})
						);
				});
		};

		event.respondWith(returnOfflineGames());
	} else
		event.respondWith(
			caches.match(event.request).then((cacheRes) => cacheRes || fetch(event.request))
		);
});

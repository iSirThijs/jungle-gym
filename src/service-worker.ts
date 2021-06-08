import { build, timestamp, files } from '$service-worker';

declare const self;

const applicationCache = `applicationCache-v${timestamp}`;
const staticCache = `staticCache-v${timestamp}`;

const returnSSRpage = (path: string) => caches.open('ssrCache').then((cache) => cache.match(path));

// Caches the svelte app (not the data)
self.addEventListener('install', (event) => {
	event.waitUntil(
		Promise.all([
			caches.open('ssrCache').then((cache) => cache.addAll(['/', '/spellen/offline'])),
			caches.open(applicationCache).then((cache) => cache.addAll(build)),
			caches.open(staticCache).then((cache) => cache.addAll(files))
		])
			.then(self.skipWaiting())
			.then(() => console.log('installed'))
	);
});

// Removes old caches
self.addEventListener('activate', (event) => {
	event.waitUntil(
		clients.claim(),
		caches
			.keys()
			.then((keys) => {
				return Promise.all(
					keys
						.filter(
							(key) =>
								key !== applicationCache &&
								key !== staticCache &&
								key !== 'gameCache' &&
								key !== 'ssrCache'
						)
						.map((key) => caches.delete(key))
				);
			})
			.then(self.skipWaiting())
			.then(() => console.log('activated'))
	);
});

self.addEventListener('fetch', (event) => {
	const request: Request = event.request;
	const requestURL = new URL(request.url);

	if (/(spellen\.json)/.test(requestURL.pathname)) {
		const returnOfflineGames = () => {
			return fetch(event.request).catch(() => {
				return caches
					.open('gamesCache')
					.then((cache) => {
						return cache.keys().then((cacheKeys) => {
							return Promise.all(cacheKeys.map((cacheKey) => cache.match(cacheKey)));
						});
					})
					.then((cachesResponses) => {
						return Promise.all(cachesResponses.map((response) => response.json()));
					})
					.then((games) => {
						const response = new Response(JSON.stringify(games), { statusText: 'offline' });
						return response;
					});
			});
		};

		event.respondWith(returnOfflineGames());
	} else if (
		/(\/spellen\/)(\w+-?)*/.test(requestURL.pathname) &&
		!/(.css)|(.js)$/.test(requestURL.pathname)
	) {
		const findOfflineGame = () =>
			caches
				.match(request)
				.then((response) => (response ? response : fetch(request)))
				.catch(() => returnSSRpage('/spellen/offline'));

		event.respondWith(findOfflineGame());
	} else event.respondWith(caches.match(request).then((cacheRes) => cacheRes || fetch(request)));
});

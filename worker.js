var resolver;

addEventListener("fetch", e => {
	console.log("Fetch: ", e)
	e.waitUntil(async () => {
		const mc = await caches.open(main);
		e.respondWith(await mc.match(e.request) ?? await fetch(e.request));
		console.log(await mc.match(e.request));
	})
})

addEventListener("install", async function(e) {
	console.log('Install!');
	e.waitUntil(new Promise((res) => {resolver=res}));
	//auto halt after 5s
	setTimeout(resolver, 10000);

	setInterval(reload, 5*60*1000); //reload every hour, just in case.
	await reload();
	
	resolver();

});

addEventListener("activate", clients.claim.bind(clients));

async function reload() {
	const {ver} = await fetch("/pwathings/appver.json").then(v => v.json());
	const cache = await caches.open(String(ver));

	if ((await cache.keys()).length == 0) {
		console.log("Reloading all resources...");
		await recursiveLinkWalker("/", cache);
		console.log("Done!");
		console.log("Overwriting main cache.");
		await caches.delete("main");
		const mc = await caches.open("main");
		for (const k of await cache.keys())
			await mc.put(k, await cache.match(k));
		console.log("Done!");
	}
}

async function recursiveLinkWalker(url, cache, visits=[], constrain=["circuits.aleteoryx.me"]) {
	const urlobj = new URL(url, "https://circuits.aleteoryx.me");
	console.dir(urlobj, String(urlobj));
	if (!constrain.includes(urlobj.hostname) || visits.includes(url))
		return;

	try {
		const data = await fetch(url);
		if (!data.ok) throw new Error("Failed to get the page!")
		const blob = await data.blob();
		await cache.put(url, new Response(blob));
		visits.push(url);

		const mime = blob.type;
		const text = await blob.text();
		console.log(url, mime);
		
		switch (mime.split("/").at(-1)) {
			case 'css':
				const cssregex = /url\((?:'|"|)([^'")]+)(?:'|"|)\)/gm;
				var match;
				while (match = cssregex.exec(text)) {
					await recursiveLinkWalker(match[1], cache, visits, constrain);
				}
				break;
			case 'html':/*
				Because the gods hate me, service workers lack this functionality below.
				Regex time!

				const doc = new Document();
				doc.documentElement.innerHTML = text;

				const HREFed = [...(["link", "a"].map(n => Array.from(doc.getElementsByTagName(n))))].flatten();
				const SRCes =  [...(["img", "script"].map(n => Array.from(doc.getElementsByTagName(n))))].flatten();
				
				for (const h of HREFed) await recursiveLinkWalker(h.getAttribute('href'), cache, visits, constrain);
				for (const s of SRCes) await recursiveLinkWalker(h.getAttribute('src'), cache, visits, constrain);
				*/
				const hreftagre = /<\w+\s+(?:(?!href=)\w+(?:="[^"]*")?\s+)*href="([^"]*)"(?:\s+\w+(?:="[^"]*")?)*\s*\/?>/gm
				const srctagre = /<\w+\s+(?:(?!src=)\w+(?:="[^"]*")?\s+)*src="([^"]*)"(?:\s+\w+(?:="[^"]*")?)*\s*\/?>/gm;

				var match;
				while (match = hreftagre.exec(text))
					await recursiveLinkWalker(match[1], cache, visits, constrain);
				while (match = srctagre.exec(text))
					await recursiveLinkWalker(match[1], cache, visits, constrain);
				break;

			case 'json':
				//to make sure we don't go rifling through all the fascinating URLs in 'circuitsv2.json'
				const whitelist = ["/pwathings/manifest.json"]
				if(!whitelist.map(m => url.endsWith(m)).reduce((a,b) => a||b)) break;
				const walker = async (obj) => {
					switch (typeof obj) {
						case 'string':
							await recursiveLinkWalker(obj, cache, visits, constrain);
							break;
						case 'object':
							for (const k of Object.values(obj))
								await walker(k);
							break;
					}
				}
				await walker(JSON.parse(text));
				break;
				
		}
	} catch (e) {
		console.log(e);
		return;
	}
	console.log("returning naturally", url, visits);
}
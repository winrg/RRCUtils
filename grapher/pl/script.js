window.addEventListener('load', async e => {
	const frame  = document.getElementById('frame');
	const author = document.getElementById('author');
	const linker = document.getElementById('linker');
	
	linker.target = window.location.hash.substr(1);
	
	const graph = await (await fetch(`https://graphpl.aleteoryx.me/load/${window.location.hash.substr(1)}`)).json()
	if (frame.contentWindow.document.readyState != 'complete')
		await new Promise((res, rej) => frame.contentWindow.addEventListener('load', e => {res();}));
	
	author.innerText = graph.author ? graph.author : [
		"a ghost",
		"nobody",
		"thine mother",
		"god's mistake",
		"the zodiac killer",
		"tyleo, secretly",
		"someone else",
		"Danny Elfman",
		"a rat in a cage",
		"viewers like you"
		][Math.round(Math.random() * 10)];

	frame.contentWindow.postMessage({type: 'lock'});
	frame.contentWindow.postMessage({type: 'loadGraph', graph: graph});

	linker.addEventListener('click', e => {
		let newwin = window.open('', window.location.hash.substr(1));
		window.onmessage = ({data}) => {
			console.log(data.type);
			if(data.type == 'grapherLoaded') {
				newwin.postMessage({type: 'loadGraph', graph: graph});
				newwin.name = '';
				window.onmessage = null;
			}
		}
	})

})
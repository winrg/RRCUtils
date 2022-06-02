/*
Serialization format:

{
	"chips": [
		{
			"GUID": String,
			"pos": {
				"x":    Number,
				"y":    Number
			},
			"to": {
				<See the 'chip.currentOverrides' property>
			}
		}
	],

	"connections": [
		{
			"i": {
				"chipidx": Number,
				"portidx": Number
			},

			o: {
				"chipidx": Number,
				"portidx": Number
			}
		}
	]
}


*/


var rrcdata;
var graph;
var searcher;
const rootel = document.documentElement;

const chips = [];

/*
[
	{
		i: {x:Number, y:Number} | <div>,
		o: {x:Number, y:Number} | <div>
	}
]
*/
const connections = [];

var clean;
var mode;
var targ;
var start;
var wirestate;
const lastmp = {x:0,y:0};

const graphPos = {x:0,y:0};

var canvas,ctx;

const allTypes = [];

function switchID(el, id) {
	const old = document.getElementById(id);
	if (old instanceof Element) old.id = '';
	if (el  instanceof Element) el .id = id;
}

function remtopx(value) {return value * parseFloat( getComputedStyle( document.documentElement ).fontSize )}

function renderCurveBetweenPorts(outx, outy, inx, iny) {
	var dist = (((outx - inx) ** 2) + ((outy - iny) ** 2)) ** 0.5;
	var heightOfCurve = Math.abs(iny - outy);
	var widthOfCurve = Math.abs(inx - outx);
	var halfWidth = (inx - outx)/2;

	var cpbasex = (Math.abs((widthOfCurve * 2) / dist * 10) + 60) * (heightOfCurve / 150)**0.8;

	var cp1x = outx + cpbasex;
	var cp2x = inx - cpbasex;

	//point(cp1x, outy);
	//point(cp2x, iny);
	//point(inx - outx, outy);

	ctx.beginPath();
	ctx.moveTo(outx,outy);
	ctx.bezierCurveTo(cp1x, outy, cp2x, iny, inx, iny);
	ctx.moveTo(outx,outy);
	ctx.closePath();
	ctx.lineWidth = 3;
	ctx.stroke();
}

function appendTypeUI(chip) {
	const data = [];

	for(const key of Object.keys(chip.typeInfo)) {
		data.push(`${key}: `);
		let m = newEl('select', 'typeSelect');
		m.classList.add(key);
		m.addEventListener('change', e => {
			if (e.target.value) chip.currentOverrides[key] = e.target.value;
			else delete chip.currentOverrides[key]

			delConnections(chip.el.querySelector('.chip'));
			chip.el.querySelector('.chip').remove();
			chip.el.querySelector('.selUI').prepend(generateChipHTML(chip.nd, chip.currentOverrides));
		});

		for(const type of chip.typeInfo[key]) {
			let opt = newEl('option');
			opt.value = (type == chip.typeInfo[key][0]) ? '' : type;
			opt.innerText = type;
			m.appendChild(opt);
		}
		data.push(m, newEl('br'))
	}

	const ui = newEl('div', 'ui');
	ui.append(...data);
	chip.el.append(ui);
}


function delConnections(el) {
	let tmp = connections.filter(con => !(((con.i instanceof Node) && el.contains(con.i)) ||
	                                      ((con.o instanceof Node) && el.contains(con.o)) || 
																				(con.i == el) || (con.i == el)));
	connections.length = 0;
	connections.push(...tmp);
}

function newChip(GUID) {
	const types = {};
	const typeParams = rrcdata.Nodes[GUID].NodeDescs[0].ReadonlyTypeParams;
	for (const desc of Object.keys(typeParams))
		types[desc] = [
			`${desc}: ${typeParams[desc]}`,
			...(typeParams[desc] == 'any' ? allTypes : typeParams[desc].match(/^\((.+)\)$/)[1].split(' | '))
		];
			
	const ne = newEl('div', 'chipbox');
	const chipcontainer = newEl('div', 'selUI');
	chipcontainer.append(generateChipHTML(rrcdata.Nodes[GUID].NodeDescs));
	ne.append(chipcontainer);
	graph.append(ne);
	
	let newchipx = -graphPos.x + (graph.getClientRects()[0].width  / 2) - (ne.getClientRects()[0].width  / 2);
	let newchipy = -graphPos.y + (graph.getClientRects()[0].height / 2) - (ne.getClientRects()[0].height / 2);
	ne.style.setProperty('--chipOffsetX', newchipx);
	ne.style.setProperty('--chipOffsetY', newchipy);

	const chip = {
		el: ne,
		typeInfo: types,
		currentOverrides: {},
		nd: rrcdata.Nodes[GUID].NodeDescs,
		GUID: GUID,
	};
	
	appendTypeUI(chip);
	chips.push(chip);

	return chip;
}
function newChipHandler({GUID}) {
	newChip(GUID);
}

function serializeGraph() {
	const ret = {
		chips: [],
		connections: []
	};

	for (const chip of chips) {
		let x = Number(chip.el.style.getPropertyValue('--chipOffsetX'));
		let y = Number(chip.el.style.getPropertyValue('--chipOffsetY'));
		
		ret.chips.push({
			GUID: chip.GUID,
			pos: {
				x: isNaN(x) ? 0 : x,
				y: isNaN(y) ? 0 : y
			},
			to: chip.currentOverrides
		})
	}

	for(const con of connections) {
		if ((con.i instanceof Node) && (con.o instanceof Node)) {
			const sCon = {
				i: {
					chipidx: -1,
					portidx: -1
				},

				o: {
					chipidx: -1,
					portidx: -1
				}
			}
			for (const key of Object.keys(chips)) {
				if (chips[key].el.contains(con.i)) {
					sCon.i.chipidx = Number(key);
					sCon.i.portidx = Array.from(chips[key].el.querySelector('.input').children).indexOf(con.i) / 2
				}
				if (chips[key].el.contains(con.o)) {
					sCon.o.chipidx = Number(key);
					sCon.o.portidx = Array.from(chips[key].el.querySelector('.output').children).indexOf(con.o) / 2
				}
			}
			ret.connections.push(sCon);
		}
	}
	return ret;
}

function deserializeGraph(graph) {
	for(const chip of chips) {
		chip.el.remove();
	}
	chips.length = 0;
	connections.length = 0
	for (const chip of graph.chips) {
		const newchip = newChip(chip.GUID);

		newchip.el.style.setProperty('--chipOffsetX', chip.pos.x);
		newchip.el.style.setProperty('--chipOffsetY', chip.pos.y);

		newchip.currentOverrides = chip.to;

		for (const ov of Object.entries(chip.to)) {
			const selector = newchip.el.querySelector(`select.${ov[0]}`);
			if (!selector) {console.warn(`unused type override in deserialization ${ov[0]}: ${ov[1]}`); continue;}
			if (![...selector.options].map(opt => opt.value).includes(ov[1])) {console.warn(`invalid type override in deserialization ${ov[0]}: ${ov[1]}`); continue;}
			selector.value = ov[1];
		}

		newchip.el.querySelector('.chip').remove();
		newchip.el.querySelector('.selUI').prepend(generateChipHTML(newchip.nd, newchip.currentOverrides));
	}

	for (const con of graph.connections) {
		const inputschip = chips[con.i.chipidx];
		if(!inputschip) {console.warn(`invalid connection ${JSON.stringify(con)}`); continue;}
		const input = inputschip.el.querySelector('.input').children[con.i.portidx * 2];
		if(!input) {console.warn(`invalid connection ${JSON.stringify(con)}`); continue;}

		const outputschip = chips[con.o.chipidx];
		if(!outputschip) {console.warn(`invalid connection ${JSON.stringify(con)}`); continue;}
		const output = outputschip.el.querySelector('.output').children[con.o.portidx * 2];
		if(!output) {console.warn(`invalid connection ${JSON.stringify(con)}`); continue;}

		connections.push({
			i: input,
			o: output
		});
	}
}
function loadGraphHandler({graph}) {
	deserializeGraph(graph);
}

var locked = false;

function lockGraph() {
	locked = true;
	document.getElementById('searchbox').remove();
	document.getElementById('helpbox')  .remove();
	document.getElementById('plbox')  .remove();
}

async function getPermalink() {
	const linker = document.getElementById('linktarget');
	const linkerp = document.getElementById('linkprefix');
	const ab = document.getElementById('authorbox');

	const ret = await fetch('https://graphpl.aleteoryx.me/save', {
		method: 'POST',
		body:   JSON.stringify({...serializeGraph(), author: ab.value ? ab.value : undefined})
	}).then(m => m.text())
	console.log(ret);
	linkerp.innerText = "Success! Permalinked at:"
	linker.href      = `https://circuits.aleteoryx.me/grapher/pl#${ret}`
	linker.innerText = `https://circuits.aleteoryx.me/grapher/pl#${ret}`
}

window.onload = async function() {
	graph = document.getElementById("graph");
	searcher = document.getElementById("searcher");
	rrcdata = await fetch(/*"https://raw.githubusercontent.com/tyleo-rec/CircuitsV2Resources/master/misc/circuitsv2.json"/*/"/circuits.json")
				   .then(res => res.json());

	allTypes.push(...ListAllTypes(rrcdata.Nodes).sort((a,b) => (a.toLowerCase() > b.toLowerCase()) ? 1 : -1));

	window.onmessage = function({data}) {
		clean = false
		switch(data.type) {
		case 'newChip':
			newChipHandler(data);
			break;
		case 'loadGraph':
			loadGraphHandler(data);
			break;
		case 'lock':
			lockGraph();
			break;
		}

	}

	graph.addEventListener('mousedown', function(e) {
		if ((e.buttons & 1) && !locked) {
			start = performance.now();
			targ = e.target;
			if (e.target.parentElement.matches('.input')) {
				if (!e.target.matches('.exec')) delConnections(e.target);
				mode = 'wire_i-o';
				wirestate = {
					i: e.target,
					o: lastmp
				};
				connections.push(wirestate);
			}

			else if (e.target.parentElement.matches('.output')) {
				if (e.target.matches('.exec')) delConnections(e.target);
				mode = 'wire_o-i';
				wirestate = {
					i: lastmp,
					o: e.target
				};
				connections.push(wirestate);
			}

			else if (targ = (
				() => {
					for (const node of chips) if (node.el.contains(e.target)) return node.el;
					return false;
				})()
			)
				mode = 'drag';

			else if (e.target == graph) switchID(null, 'selected')
			clean = false
		}
	});

	rootel.addEventListener("mouseup", e => {
		if ((e.button == 0) && !locked) {
			let newCon;
			switch (mode) {
			case 'wire_i-o':
				connections.pop()
				newCon = {i: wirestate.i, o: e.target}
				if (e.target.matches('.exec')) delConnections(e.target);
				if (e.target.parentElement.matches('.output') && (newCon.i.nextElementSibling.innerText == newCon.o.nextElementSibling.innerText))
					connections.push(newCon);
				break;
			case 'wire_o-i':
				connections.pop()
				newCon = {o: wirestate.o, i: e.target}
				if (!e.target.matches('.exec') && !e.target.matches('#graph')) delConnections(e.target);
				if (e.target.parentElement.matches('.input') && (newCon.i.nextElementSibling.innerText == newCon.o.nextElementSibling.innerText))
					connections.push(newCon);
				break;
			case 'drag':
				if ((performance.now() - start) < 150 && !targ.querySelector('.selUI').matches('#selected')) {
					switchID(targ.children[0], 'selected')
				}
				break;
			}
			mode = null;
			clean = false
		}
	});

	rootel.addEventListener("mousemove", e => {
		if (e.buttons & 2) {
			mode = '';
			let tmp = connections.pop();
			if ((tmp.i instanceof Element) && (tmp.o instanceof Element)) connections.push(tmp);
			clean = false
		}
		if (e.buttons & 4) {
			graphPos.x += e.clientX - lastmp.x;
			graphPos.y += e.clientY - lastmp.y;
			graph.style.setProperty('--graphOffsetX', graphPos.x);
			graph.style.setProperty('--graphOffsetY', graphPos.y);
			clean = false
		}
		switch (mode) {
		case 'drag':
			let newchipx = Number(targ.style.getPropertyValue('--chipOffsetX')) + e.clientX - lastmp.x;
			let newchipy = Number(targ.style.getPropertyValue('--chipOffsetY')) + e.clientY - lastmp.y;
			targ.style.setProperty('--chipOffsetX', newchipx);
			targ.style.setProperty('--chipOffsetY', newchipy);
			clean = false
			break;
		}
		lastmp.x = e.clientX;
		lastmp.y = e.clientY;
		if (mode) 
			clean = false
	});


	root.addEventListener("mousemove", e => {
  	root.style.setProperty('--mouse-x', (e.clientX - graphPos.x - searcher.clientWidth) + "px");
  	root.style.setProperty('--mouse-y', (e.clientY - graphPos.y) + "px");
	});

	function deleteSel() {
		let sel = document.getElementById("selected").parentElement;
		if (!sel) return;
		delConnections(sel);
		{
			let tmp = chips.filter(chip => !(chip.el == sel));
			chips.length = 0;
			chips.push(...tmp);
		}
		sel.remove();
		clean = false;
	}

	root.addEventListener("keydown", e => {
		switch (e.code) {
		case 'Delete':
			deleteSel();
			break;
		case 'KeyS':
			console.log(serializeGraph());
			break;
		}
	});


	canvas = document.getElementById('canvas');
	ctx = canvas.getContext('2d');
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	window.addEventListener("resize", e => {
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
		clean = false
	});

	(async function updateanim(t) {

		if(!clean) { 
		ctx.clearRect(0,0,window.innerWidth,window.innerHeight);
		for(const wire of connections) {
			const points = [];

			for (const point of [wire.o, wire.i]) {
				if (point instanceof Element) {
					let rects = point.getClientRects()[0];
					points.push(point == wire.i ? rects.left - remtopx(1.5) : rects.right + remtopx(1.1));
					points.push((rects.top + rects.bottom) / 2);
				} else {
					points.push(point.x);
					points.push(point.y);
				}
			}

			if ((((points[0] >= -10) && (points[0] <= window.innerWidth)) &&
			     ((points[1] >= -10) && (points[1] <= window.innerHeight))) ||
				  (((points[2] >= -10) && (points[2] <= window.innerWidth)) &&
				   ((points[3] >= -10) && (points[3] <= window.innerHeight)))) {

				var m = null;
				for (const cls of (wire.i instanceof Element ? wire.i : wire.o).classList) m = m || portColors[cls];
				ctx.strokeStyle = m;
				renderCurveBetweenPorts(...points);
			}
		}
		clean = true;
		}
		requestAnimationFrame(updateanim);
	})()

	if(window.opener) opener.postMessage({type: 'grapherLoaded'});
}

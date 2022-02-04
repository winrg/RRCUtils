var v2data;
var graph;
var searcher;
const rootel = document.documentElement;

const chips = [];

/*
[
	{
		i: func() -> {x:Number, y:Number} | <div>,
		o: func() -> {x:Number, y:Number} | <div>
	}
]
*/
const connections = [];

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
		m.addEventListener('change', e => {
			if (e.target.value) chip.currentOverrides[key] = e.target.value;
			else delete chip.currentOverrides[key]

			delConnections(chip.el.children[0].children[0]);
			chip.el.children[0].children[0].remove();
			chip.el.children[0].prepend(generateChipHTML(chip.nd, chip.currentOverrides));
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

window.onload = async function() {
	graph = document.getElementById("graph");
	searcher = document.getElementById("searcher");
	v2data = await fetch(/*"https://raw.githubusercontent.com/tyleo-rec/CircuitsV2Resources/master/misc/circuitsv2.json"/*/"/circuitsv2.json")
				   .then(res => res.json());

	allTypes.push(...ListAllTypes(v2data.Nodes).sort((a,b) => (a.toLowerCase() > b.toLowerCase()) ? 1 : -1));

	window.onmessage = function({data}) {
		if (data.type == 'newChip') {
			const types = {};
			const typeParams = v2data.Nodes[data.GUID].NodeDescs[0].ReadonlyTypeParams;
			for (const desc of Object.keys(typeParams))
				types[desc] = [
					`${desc}: ${typeParams[desc]}`,
					...(typeParams[desc] == 'any' ? allTypes : typeParams[desc].match(/^\((.+)\)$/)[1].split(' | '))
				];
			
			const ne = newEl('div', 'chipbox');
			const chipcontainer = newEl('div', 'selUI');
			chipcontainer.append(generateChipHTML(v2data.Nodes[data.GUID].NodeDescs));
			ne.append(chipcontainer);
			graph.append(ne);
			const chip = {
				el: ne,
				typeInfo: types,
				currentOverrides: [],
				nd: v2data.Nodes[data.GUID].NodeDescs
			};
			appendTypeUI(chip);
			chips.push(chip);
			console.log(types);
		}
	}

	graph.addEventListener('mousedown', function(e) {
		if (e.button == 0) {
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
		}
	});

	rootel.addEventListener("mouseup", e => {
		if (e.button == 0) {
			switch (mode) {
			case 'wire_i-o':
				if (e.target.matches('.exec')) delConnections(e.target);
				wirestate.o = e.target;
				if (!e.target.parentElement.matches('.output'))
					connections.pop();
				else if (wirestate.i.nextElementSibling.innerText != wirestate.o.nextElementSibling.innerText)
					connections.pop();
				break;
			case 'wire_o-i':
				if (!e.target.matches('.exec')) delConnections(e.target);
				wirestate.i = e.target;
				if (!e.target.parentElement.matches('.input'))
					connections.pop();
				else if (wirestate.i.nextElementSibling.innerText != wirestate.o.nextElementSibling.innerText)
					connections.pop();
				break;
			case 'drag':
				if ((performance.now() - start) < 150 && !targ.children[0].matches('#selected')) {
					switchID(targ.children[0], 'selected')
				}
				break;
			}
			mode = null;
		}
	});

	rootel.addEventListener("mousemove", e => {
		if (e.buttons & 4) {
			graphPos.x += e.clientX - lastmp.x;
			graphPos.y += e.clientY - lastmp.y;
			graph.style.setProperty('--graphOffsetX', graphPos.x);
			graph.style.setProperty('--graphOffsetY', graphPos.y);
		}
		switch (mode) {
		case 'drag':
			let newchipx = Number(targ.style.getPropertyValue('--chipOffsetX')) + e.clientX - lastmp.x;
			let newchipy = Number(targ.style.getPropertyValue('--chipOffsetY')) + e.clientY - lastmp.y;
			targ.style.setProperty('--chipOffsetX', newchipx);
			targ.style.setProperty('--chipOffsetY', newchipy);
			break;
		}
		lastmp.x = e.clientX;
		lastmp.y = e.clientY;
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
	}

	root.addEventListener("keydown", e => {
		switch (e.code) {
		case 'Delete':
			deleteSel();
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
	});

	(async function updateanim(t) {


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

		requestAnimationFrame(updateanim);
	})()
}

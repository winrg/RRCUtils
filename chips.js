let root = document.documentElement;

if (window.location.pathname != '/grapher/')
	root.addEventListener("mousemove", e => {
  	root.style.setProperty('--mouse-x', e.clientX + "px");
  	root.style.setProperty('--mouse-y', e.clientY + "px");
	});


const portColors = {
	float:   '#186adc',
	int:     '#0f6522',
	exec:    '#f55b18',
	string:  '#794284',
	bool:    '#ea2e50',
	any:     '#f6eee8',
	special: '#f4c61e'
}
const	typeRegex = /(?:^|(?<=<))(?:int|float|bool|string|exec)(?:$|(?=>))/;
const unionRegex = /^T\d*$|(?<=List<)T\d*(?=>)/;

function computeType(Type, TypeParams, to) {
	let t = Type;
	if (to) for (const o of Object.keys(to)) t = t.replace(o, to[o]);
	let tc = "special"
	if (typeRegex.test(t)) {
		tc = t;
	} else if (unionRegex.test(t)) {
		let tn = t.match(unionRegex)[0];
		let ut = TypeParams[tn];
		t = t.replace(unionRegex, `${tn}: ${ut}`)

		tc = "any";
	}
	return {typeclass: tc, type: t};
}

function generateChipHTML(NodeDescs, typeoverride = undefined) {
	for (let cur of NodeDescs) {
		let ins = cur.Inputs;
		let outs = cur.Outputs;

		const root = newEl('div', 'chip');
		const header = newEl('div', 'chipheader');
		header.innerText = cur.Name;
		const input = newEl('div', 'input');
		const output = newEl('div', 'output');
		root.append(header, input, output);

		for (const inp of ins) {
			//work out the type
			let {typeclass, type} = computeType(inp.ReadonlyType, cur.ReadonlyTypeParams, typeoverride);

			const port = newEl('div', typeclass);
			port.innerHTML = inp.Name + "&nbsp;";
			if (type.includes("List")) port.classList.add("list");

			const tooltip = newEl('div', 'type');
			tooltip.innerText = type;

			input.append(port, tooltip);
		}

		for (const out of outs) {
			//work out the type
			let {typeclass, type} = computeType(out.ReadonlyType, cur.ReadonlyTypeParams, typeoverride);

			const port = newEl('div', typeclass);
			port.innerHTML = out.Name + "&nbsp;";
			if (type.includes("List")) port.classList.add("list");

			const tooltip = newEl('div', 'type');
			tooltip.innerText = type;

			output.append(port, tooltip);
		}
		return root;
	}
}

function ListAllTypes(Nodes) {
	let m = new Set();
	for (const n of Object.values(Nodes)) {
		for (const desc of n.NodeDescs) {
			for (const td of Object.values(desc.ReadonlyTypeParams))
				if (/^[A-Za-z0-9 ]+$/.test(td)) m.add(td);
			for (const port of [...desc.Inputs, ...desc.Outputs])
				if (/^[A-Za-z0-9 ]+$/.test(port.ReadonlyType) && !/^[A-Za-z]\d*$/.test(port.ReadonlyType)) m.add(port.ReadonlyType);
		}
	}
	m.delete('any');
	return Array.from(m);
}
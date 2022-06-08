//Gods-awful type-checking logic.

//TypeName: string, Params: Array<string>
function Type(TypeName,Params=[]) {
	if (!Type.all) Type.all = {};
	this.typename = "";
	this.mode = "";
	
	if (TypeName instanceof Type) {
		const t = TypeName.copy();
		for (const k in t) {
			this[k] = t[k];
		}
		return;
	}
	
	//Union/Tuple
	if (/^\(.+\)$/.test(TypeName)) {
		const types = [];
		var depth = 0;
		var workspace = "";
		for (const c of /^\((.+)\)$/.exec(TypeName)[1]) {
			switch (c) {
				case '(':
				case '<':
					depth++;
					break;
				case ')':
				case '>':
					depth--;
					break;
				case ',':
					if (depth == 0) {
						this.mode = "tuple";
						types.push(workspace);
						workspace = "";
						continue;
					}
					break;
				case '|':
					if (depth == 0) {
						this.mode = "union";
						types.push(workspace);
						workspace = "";
						continue;
					}
					break;
			}
			workspace += c;
		}
		if (workspace) types.push(workspace);
		this.template = types.map(t => t.trim()).map(t => new Type(t, Params));
	}
	//Template
	else if (/^[^<]+<.+>$/.test(TypeName)) {
		this.typename = /^([^<]+)</.exec(TypeName)[1];
		this.mode = "templated";
		const types = [];
		var depth = 0;
		var workspace = "";
		for (const c of /^[^<]+<(.+)>$/.exec(TypeName)[1]) {
			switch (c) {
				case '(':
				case '<':
					depth++;
					break;
				case ')':
				case '>':
					depth--;
					break;
				case ',':
					if (depth == 0) {
						types.push(workspace);
						workspace = "";
						continue;
					}
					break;
			}
			workspace += c;
		}
		if (workspace) types.push(workspace);
		this.template = types.map(t => t.trim()).map(t => new Type(t, Params));
		Type.all[this.typename] = () => new Type(TypeName, Array.from(Params));
	}
	//Standard Type, or Template Param
	else if (/^[^()|<>,]+$/.test(TypeName)) {
		if (!Params.includes(TypeName)) {
			this.typename = TypeName;
			this.mode = (TypeName == 'any') ? "any" : "standard";
			if (this.mode == "standard") Type.all[this.typename] = () => new Type(TypeName);
		} else {
			this.mode = "param";
			this.typename = TypeName;
			this.template = Type.any;
		}
	}
}

Type.prototype.toString = function(info=false) {
	switch (this.mode) {
		case "tuple":
			return `(${this.template.join(',')})`;
		case "union":
			return `(${this.template.join('|')})`;
		case "templated":
			return `${this.typename}<${this.template.join(',')}>`;
		case "any":
		case "standard":
			return this.typename;
		case "param":
			return info ? `${this.typename}: ${this.template}` : this.template.toString();
	}
}

Type.prototype._resolve = function(key, val) {
	if (this.mode != "param") {
		if (val === undefined && this.template?.length === 1) {
			val = key;
			key = 0;
		}
		if (this.template?.length) this.template = this.template.map(t => t.resolve(key, val));
	} else {
		if (this.typename == key) this.template = new Type(val)
	}
}

Type.prototype.resolve = function(key, val) {
	const t = this.copy();
	t._resolve(key, val);
	return t;
}

Type.prototype.copy = function() {
	if (this.mode != "param") {
		const t = new Type(this.toString());
		for (const k in this.template)
			t.template[k] = this.template[k].copy();
		return t;
	} else {
		const t = new Type(this.typename, [this.typename]);
		t._resolve(this.typename, this.toString())
		return t;
	}
}

Type.prototype.getClasses = function() {
	if (this.mode == "param") return this.template.getClasses();
	const ret = new Set();
	switch (this.mode) {
		case 'standard':
			switch (this.typename) {
				case 'bool':
				case 'int':
				case 'float':
				case 'string':
					ret.add(this.typename);
					break;
				default:
					ret.add('special');
					break;
			}
			break;
		case 'templated':
			if (this.template.length == 1) {
				if (this.typename == "List") ret.add("list");
				this.template[0].getClasses().forEach(ret.add.bind(ret));
			} else {
				ret.add('any');
			}
			
			break;
		case 'union':
		case 'tuple':
		case 'any':
			ret.add('any');
			break;
	}
	return Array.from(ret);
}

//just makes my life that much easier when writing code. Type.any is nicer than new Type('any')
Type.typeDef = (function(typename, name, params=[]) {
	Object.defineProperty(this, typename, {
		get: () => new Type(name, params)
	})
}).bind(Type)
Type.QuickTD = (function(name, params=[]) {
	Object.defineProperty(this, (new Type(name, params)).typename, {
		get: () => new Type(name, params)
	})
}).bind(Type)

Type.QuickTD("any");
Type.QuickTD("int");
Type.QuickTD("float");
Type.QuickTD("string");
Type.QuickTD("bool");
Type.QuickTD("Vector3");
Type.typeDef("list", "List<T>", ["T"]);

function intersect(type1, type2) {
	const T1 = new Type(type1.toString());
	const T2 = new Type(type2.toString());

	if(T1 == T2) return T1;

	if (T1.mode == "any") return T2;
	if (T2.mode == "any") return T1;
	if (T1.mode == T2.mode) {
		switch (T1.mode) {
			case "standard":
				return (String(T1) == String(T2)) ? T1 : null;
			case "templated":
			case "tuple":
				if (
					T1.typename != T2.typename ||
					T1.template.length != T2.template.length
				) return null;
				var t = T1.copy();
				for (const k in T1.template)
					t.template[k] = intersect(T1.template[k], T2.template[k]);
				if (t.template.includes(null))
					return null;
				else return t;
			case "union":
				const rettempl = Array.from(
					new Set(
						T1.template.map(
							t => T2.template
								.map(t2 => intersect(t,t2))
								.filter(t => t ?? false))
						.flat().map(String)
					)).map(n => new Type(n));
				if (rettempl.length > 1) {
					const ret = T1.copy();
					ret.template = rettempl;
					return ret;
				}
				else if (rettempl.length) return rettempl[0];
				return null
		}
	} else if ([T1.mode,T2.mode].includes("union")) {
		const UT = (T1.mode == "union") ? T1 : T2;
		const ST = (T1.mode == "union") ? T2 : T1;
		const isect = Array.from(
			new Set(
				UT.template
				.map(t => intersect(ST, t))
				.filter(t => t ?? false)
				.map(String)
			)).map(n => new Type(n));
		if (isect.length > 1) {
			const ret = UT.copy();
			ret.template = isect;
			return ret;
		}
		else if (isect.length) return isect[0];
	}
	return null;
}
function intersectParams(type1, type2) {
	const sect = intersect(type1, type2);
	if (!(sect ?? false)) return null;

	function walkDown(t, tres) {
		const ret = {};
		if (t.mode == "param") {
			ret[t.typename] = tres;
		}
		else if (
			t.mode == tres.mode &&
			t.typename == tres.typename &&
			t.template?.length == tres.template?.length
		) {
			for (const p in t.template)
				ret = {...ret, ...walkDown(t.template[p], tres.template[p])};
		}
		return ret;
	}
	const resolution1 = walkDown(type1, sect);
	const resolution2 = walkDown(type2, sect);
	return [resolution1, resolution2];
}

function Chip(Entry) {
	this.types = [];
	if (Entry.ChipNameSource != "FirstNodeDesc") throw new TypeError("Chip is not FirstNodeDesc mode!");

	const cur = Entry.NodeDescs[0];
	const params = cur.ReadonlyTypeParams;
	const passed = Object.keys(params)
	
	this.root = newEl('div', 'chip');
	const header = newEl('div', 'chipheader');
	header.innerText = cur.Name;
	const input = newEl('div', 'input');
	const output = newEl('div', 'output');
	this.root.append(header, input, output);
	const genPort = (port) => {
		let classes,name;
		if (port.ReadonlyType != "exec") {
			const type = Object.entries(params).reduce((t,[k,v])=>t.resolve(k,v),new Type(port.ReadonlyType, passed));
			Object.entries(params).forEach(t => type.resolve(t[0], t[1]));
			classes = type.getClasses();
			name = type.toString();
			this.types.push(type);
		} else {
			classes = ["exec"];
			name = "exec";
		}
		
		const ret = newEl('div', '');
		ret.innerHTML = port.Name + "&nbsp;";
		classes.forEach(p => ret.classList.add(p))

		const tooltip = newEl('div', 'type');
		tooltip.innerText = name;

		return [ret, tooltip];
	}

	input.append(...cur.Inputs.map(genPort).flat());
	output.append(...cur.Outputs.map(genPort).flat());
}


//chips.js reimplemented with the above

let root = document.documentElement;
if (window.location.pathname != '/grapher/') {
	root.addEventListener("mousemove", e => {
  	root.style.setProperty('--mouse-x', e.clientX + "px");
  	root.style.setProperty('--mouse-y', e.clientY + "px");
	});
}

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

function computeType(tn, TypeParams, to) {
	if (tn != "exec") {
		const t = Object.entries({...TypeParams, ...to}).reduce((t,i) => t.resolve(...i), new Type(tn, Object.keys(TypeParams)));
		return {typeclass: t.getClasses(), type: t.toString()};
	} else {
		return {typeclass: ['exec'], type: 'exec'};
	}
}

//keeping this the same for now
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

			const port = newEl('div', '');
			port.innerHTML = inp.Name + "&nbsp;";
			typeclass.map(port.classList.add.bind(port.classList));

			const tooltip = newEl('div', 'type');
			tooltip.innerText = type;

			input.append(port, tooltip);
		}

		for (const out of outs) {
			//work out the type
			let {typeclass, type} = computeType(out.ReadonlyType, cur.ReadonlyTypeParams, typeoverride);

			const port = newEl('div', '');
			port.innerHTML = out.Name + "&nbsp;";
			typeclass.map(port.classList.add.bind(port.classList));

			const tooltip = newEl('div', 'type');
			tooltip.innerText = type;

			output.append(port, tooltip);
		}

		return root;
	}

}

function ListAllTypes(Nodes) {
	return Object.keys(Type.all);
}
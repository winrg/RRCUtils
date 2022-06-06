//Gods-awful type-checking logic.

//TypeName: string, Params: Array<string>
function Type(TypeName,Params=[]) {
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
		this.template = types.map(t => t.trim()).map(t => Params.includes(t) ? Type.any : new Type(t, Params));
		
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
		this.template = types.map(t => t.trim()).map(t => Params.includes(t) ? t : new Type(t, Params));
	}
	//Standard Type
	else if (/^[^()|<>,]+$/.test(TypeName)) {
		this.typename = TypeName;
		this.mode = (TypeName == 'any') ? "any" : "standard"
	}
}

Type.prototype.toString = function() {
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
	}
}

Type.prototype._resolve = function(idx, val) {
	if (val === undefined && this.template.length === 1) {
		val = idx;
		idx = 0;
	}
	if (0 <= idx && this.template.length > idx) {
		this.template = this.template?.map(t => (t === name) ? val.copy() : ((typeof t == 'string') ? t : t.resolve(name, val)))
	}
}

Type.prototype.resolve = function(idx, val) {
	const t = this.copy();
	t._resolve(idx, val);
	return t;
}

Type.prototype.copy = function() {
	const t = new Type(this.toString(), this.template?.filter(t => typeof t == 'string'));
	return t;
}

Type.prototype.intersect = function(ot, params=[]) {
	if (!ot instanceof Type)   ot = new Type(ot, params)
	if (this.mode == 'any') return ot.copy();
	if (ot.mode == 'any') return this.copy();
	if (ot.mode != this.mode) return undefined;
	
	switch (ot.mode) {
		case 'templated':
		case 'union':
		case 'tuple':
			if (this.template.length != ot.template.length) return undefined;
		case 'standard':
			if (ot.typename == this.typename)
				return this.copy();
			else return undefined;
			
	}
}

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
Type.QuickTD("List<T>", ["T"]);
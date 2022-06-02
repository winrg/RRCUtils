//Gods-awful type-checking logic.

//TypeName: string, Params: Array<string>
function Type(TypeName,Params=[]) {
	this.typename = "";
	this.mode = "";
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
		this.template = types.map(t => t.trim()).map(t => ["any", ...Params].includes(t) ? t : new Type(t, Params));
		
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
		this.template = types.map(t => t.trim()).map(t => ["any", ...Params].includes(t) ? t : new Type(t, Params));
	}
	//Standard Type
	else if (/^[^()|<>,]+$/.test(TypeName)) {
		this.typename = TypeName;
		this.mode = "standard"
	}
	
	this.params   = Object.fromEntries(Params.map(p => [p, 'any']));
}
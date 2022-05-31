/*
	Big object of code for each stateless chip. Each takes in (array<{type: String, value:any}>, {String:String})
	                                                ^Ports^                          ^typeoverrides^
	and returns an array<any> or false.
	int: bigint
	float: number
	bool: boolean
	string: string
	vector3: {x:number,y:number,z:number}
	Player: Object ----------| These two have no meaning right now. null and undefined are invalid, everything else is valid.
	Rec Room Object: Object -|
*/
function dtr (n) {return n / 360 * Math.PI * 2}
function rtd (n) {return n / (Math.PI * 2) * 360}
const SchipBehaviors = {
	//basic maths
	"98b99011-9be8-43b3-89cc-1e9d55bd8b51": ([{value}], {T}) => { //abs
		switch (T) {
		case 'float':
			return [Math.abs(value)]
			break;
		case 'int':
			return [value < 0 ? value * -1n : value]
			break;
		default:
			return false;
			break;
		}
	},
	"0ccb153c-dd08-4f22-80fd-9d8c5940928c": (values, {T}) => { //add
		switch(T) {
		case 'int':
		case 'float':
			return [values.reduce((a,b) => a+b, 0)];
			break;
		case 'Vector3':
			return [values.reduce((a,b) => ({x:a.x+b.x,y:a.y+b.y,y:a.z+b.z}), {x:0,y:0,z:0})]
			break;
		default:
			return false;
			break;
		}
	},
	
	//logic
	"3fb9fd93-8d45-4395-b9a3-63a99a14442b": (values) => [values.reduce((a,{value:b}) => a && b, true)],      //and
	"b5dcded0-eb2b-468d-a4b9-ffb1054f6214": (values) => [values.reduce((a,{value:b}) => a || b, false)],     //or
	"ff551243-beb4-470e-ab48-9d616818d5e4": ([{value}]) => [!value],                                         //not
	"3663225d-e18d-40e6-a234-ef10378528be": ([{value:a},{value:b}]) => [a==b],                               //equals
	"110c29b1-ac90-4a71-b3c0-53372aa134bc": ([{value:a},{value:b}]) => [a>b],                                //greater
	"a10e7788-f016-4390-a68e-87d93b47edb1": ([{value:a},{value:b}]) => [a>=b],                               //greater equal
	"7e58b3f4-2694-4ced-b3a8-0fe23f48f60f": ([{value:a},{value:b}]) => [a<b],                                //less
	"a027073f-9189-457f-a53d-8562e8829daf": ([{value:a},{value:b}]) => [a<=b],                               //less equal

	//trig
	"46ce50b8-0a20-43d2-9646-484ce2a6752c": ([{value}]) => [rtd(Math.acos(dtr(value)))],
	"aaa4e58f-16df-426a-b7a7-a654eab97037": ([{value}]) => [rtd(Math.asin(dtr(value)))],
	"02d62908-550d-4f8b-8bc7-0960fb1b547f": ([{value:a},{value:b}]) => [rtd(Math.atan2(dtr(a),dtr(b)))],
	"84646ed2-015e-4a8b-9d37-5115cb9ebadc": ([{value}]) => [rtd(Math.atan(dtr(value)))],

	//string
	"77afc9dd-baa9-4312-b8b8-7ef479c840e6": ([{value:fmt}, ...props]) =>
		[props.reduce((p, {value:c}, i) =>
			p.replaceAll(`{${i}}`, c),
		fmt)],
	"aa24edab-c707-4cff-8c73-07e479b4cd07": ([{value:str}, {value:seq}]) => [Boolean(str.search(seq) != -1)],
	"dcde9345-00f2-41fb-9a2d-5a938f39bfb5": ([{value:str}]) => [str.length],
	"ad169649-1050-48c5-a540-f03a2059bcdb": ([{value:str}, {value:del}]) => [str.split(del)],
	"6b92c345-e6bc-40d9-aae9-4754e634777c": ([{value:str}, {value:idx}]) => [[str.slice(0, idx), str.slice(idx)]],
	"1af21999-38f8-4231-9de9-26b43f47fe0d": ([{value:str}, {value:seq}]) => [str.search(seq)],
	"678f6d33-1e94-4be6-b959-0212c1a2207f": ([{value:str}]) => [str.toLowerCase()],
	"8f5995c7-5af0-4064-9cb7-2b80d75d157f": ([{value:str}]) => [str.toUpperCase()],
}

/*
	Big object of code for each stateful(exec-having) chip.
	"ReadonlyName": "String
*/
const EchipBehaviors = {

}
module.exports = SchipBehaviors;
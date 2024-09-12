let asm_file:string = `
GPIO EQU 0x06
start:
	BSF GPIO, 0  ; Bit Set Forward
	NOP         ; No Operation
	NOP
	MOVLW ' '
	BCF GPIO, 0  ; Bit Clear File
	GOTO start  ; GOTO
`; 




function quotedLetter(str: string): string | undefined {
	if (str.length === 3 && str.startsWith("'") && str.endsWith("'")) {
		return str.charAt(1);
	} else if (str.length === 4 && str.startsWith("'\\") && str.endsWith("'")) {
		const escapeChar = str.charAt(2);
		switch (escapeChar) {
			case 'n':
				return '\n';
			case 't':
				return '\t';
			case '\\':
				return '\\';
			default:
				return undefined;
		}
	}
	return undefined;
}


function hexToInt(inpt: string): number | undefined {
	const matchResult = inpt.match(/([0-9A-F]{2})H/i);
	if (matchResult) {
		return parseInt(matchResult[1], 16);
	}
	return undefined;
}

function asInt(inpt:string): number | undefined {
	let num:number = parseInt(inpt, 10);
	if(!isNaN(num) && !inpt.includes("b")){
		return num;
	}
	return undefined;
}




function binaryToDecimal(inpt: string): number | undefined {
	if(!inpt.startsWith("0b")) {
		return undefined;
	}
	const val = inpt.slice(2);
	if (val.length !== 8) {
		return undefined;
	}
	const num = parseInt(val, 2);
	if (num >= 0 && num <= 255) {
		return num;
	} else {
		return undefined;
	}
}



function eLiteral(inpt:string): number | undefined {

	// As qouted letter
	let ch:string | undefined = "";
	if((ch = quotedLetter(inpt)) != undefined){
		return ch.charCodeAt(0);
	}

	// As hex (00H...FFH)
	let val:number | undefined = 0;
	if((val = hexToInt(inpt)) != undefined){
		return val;
	}

	if((val = binaryToDecimal(inpt)) != undefined){
		return val;
	}

	if((val = asInt(inpt)) != undefined){
		return val;
	}

	return undefined;
}


function setByMask(inst: number, mask: number, val: number): number {
	return (inst & ~mask) | (val & mask);
}


function setIdx(inpt:string, idx:number, ch:string): string{
	let l = inpt.split("")
	l[idx] = ch;
	return l.join("");
}


function getItem(input:Map<string, number>, need:string): number | undefined {
	let items = [...input.entries()];
	for(let i = 0; i < items.length; ++i){
		if(items[i][0] == need){
			return items[i][1];
		}
	}
	return undefined;
}


type Line = {
	line: string;
	binary: string;
	value: number;
	total: string;
}


type ErrOut = {
	index: number;
	line: string;
	obj: string,
	message: string;
};


function assembler(data:string): Array<Line> | ErrOut {
	let lines:Array<string> = data.split("\n");
	let machineCode:Array<Line> = [];

	let labels:Map<string, number> = new Map<string, number>();
	// let equ_const:Array<Map<string, number>> = [];
	let equ_const:Map<string, number> = new Map<string, number>();

	for(let i:number = 0; i < lines.length; ++i){
		let line:string = lines[i];
		if(line.trim() == ""){ continue; }  // Empty line

		line = line.trim();

		// Remove Comments
		if(line.indexOf(";") >= 0){
			line = line.slice(0, line.indexOf(";")).trim();
		}

		// Remove commas
		let q:boolean = false;
		for (let x = 0; x < line.length; x++) {
			if (line[x] === "'") { q = !q; }
			if (line[x] === ',' && q === false) {
				line = setIdx(line, x, ' ')
			}
		}


		// Check for label
		if(line.indexOf(":") >= 0){
			let label:string = line.split(":")[0];
			// console.log(`LABEL: ${label}`);
			if(labels.has(label)){
				return {index: i, obj: label, message: 'Duplicate label', line: line};
			} else {
				labels.set(label, machineCode.length);
			}
			continue;
		}


		// Search For EQU constant
		if(line.indexOf("EQU") >= 0){
			let parts:Array<string> = line.split(" ");
			// console.log(`PARTS: ${parts}`);
			if(parts.length != 3){
				console.log(`Invalid EQU line: ${line} at line ${i + 1}\n\t==> ${lines[i]}`);
				return {index: i, obj: "", message: 'Invalid EQU line', line: line};
			} else {
				equ_const.set(parts[0], parseInt(parts[2], 16));
			}
			continue;
		}


		// let parts:Array<string> = line.split(RegExp(" +"));
		let parts:Array<string> = line.split(RegExp("(?<!') +"));
		let opcode:string = parts[0].trim();
		if(opcode == ""){ continue; }
		let operands:Array<string> = parts.slice(1);

		let instruction:number = 0;

		let bbb_size:number = 3;
		let fff_size:number = 5



		// BSF & BCF
		if(opcode == "BSF" || opcode == "BCF"){
			let reg:string = operands[0];
			let regn:number = 0;
			let bit = parseInt(operands[1], 10);
			if(getItem(equ_const, reg) != undefined){
				regn = getItem(equ_const, reg) as number;
			}

			if(bit > (1 << bbb_size) - 1){
				console.log(`Invalid bit: '${bit}' at line (${i + 1})\n\t==> ${lines[i]}`);
				return {index: i, obj: `${bit}`, message: 'Invalid bit', line: line};
			}

			if(regn > (1 << fff_size) - 1){
				console.log(`Invalid register: '${regn}' at line (${i + 1})\n\t==> ${lines[i]}`);
				return {index: i, obj: `${regn}`, message: 'Invalid register', line: line};
			}

			if(opcode == "BSF"){
				instruction = 0b010100000000 | (bit << 5) | regn;
			} else {
				instruction = 0b010000000000 | (bit << 5) | regn;
			}


		} else if(opcode == "MOVLW"){
			let val:number | undefined = eLiteral(operands[0]);
			if(val == undefined){
				console.log(`Invalid value at line (${i + 1})\n\t==>${lines[i]}`);
				return {index: i, obj: "", message: 'Invalid value', line: line};
			}
			instruction = 0b110000000000 | val;

		} else if(opcode == "MOVWF"){
			if(operands[0] == undefined){
				console.log(`No operand at line ${i + i}\n\t==> ${lines[i]}`);
				return {index: i, obj: "", message: 'No operand', line: line};
			}
			let reg:string = operands[0];
			let regn:number | undefined = 0;
			if((regn = getItem(equ_const, reg)) != undefined){
				instruction = setByMask(0b000000100000, 0b000000011111, regn);
			} else {
				let val:number | undefined = eLiteral(operands[0]);
				if(val != undefined){
					instruction = setByMask(0b000000100000, 0b000000011111, val);
				} else {
					return {index: i, obj: "", message: 'Invalid operands', line: line};
				}
			}



		} else if(opcode == "CLRF"){
			if(operands[0] == undefined){
				console.log(`No operand at line ${i + i}\n\t==> ${lines[i]}`);
				return {index: i, obj: "", message: 'No operand', line: line};
			}
			let reg:string = operands[0];
			let regn:number | undefined = 0;
			if((regn = getItem(equ_const, reg)) != undefined){
				instruction = setByMask(0b000001100000, 0b000000011111, regn);
			} else {
				let val:number | undefined = eLiteral(operands[0]);
				if(val != undefined){
					instruction = setByMask(0b000001100000, 0b000000011111, val);
				} else {
					console.log(`Invalid operands at line (${i + 1})\n\t==>${lines[i]}`)
					return {index: i, obj: "", message: 'Invalid operands', line: line};
				}
			}


		} else if(opcode == "CLRW"){
			instruction = 0b000001000000;

		} else if(opcode == "SLEEP"){
			instruction = 0b000000000011;


		} else if (opcode == "DECF"){
			if(operands[0] == undefined || operands[1] == undefined){
				console.log(`No operand at line ${i + i}\n\t==> ${lines[i]}`);
				return {index: i, obj: "", message: 'No operand', line: line};
			}
			let reg:string = operands[0];
			let regn:number | undefined = 0;
			let bit:number = parseInt(operands[1], 10);
			if(bit != 1 && bit != 0){
				console.log(`Invalid Bit Number (${bit}) at line ${i + 1}\n\t==>${lines[i]}\n`);
				return {index: i, obj: `${bit}`, message: 'Invalid Bit Number', line: line};
			}

			if((regn = getItem(equ_const, reg)) != undefined){
				instruction = 0b000011000000 | (bit << 5) | regn;
			} else {
				let val:number | undefined = eLiteral(operands[0]);
				if(val != undefined){
					instruction = 0b000011000000 | (bit << 5) | val;
				} else {
					console.log(`Invalid operands at line (${i + 1})\n\t==>${lines[i]}`)
					return {index: i, obj: "", message: 'Invalid operands', line: line};
				}
			}


		} else if (opcode == "DECFSZ"){
			if(operands[0] == undefined || operands[1] == undefined){
				console.log(`No operand at line ${i + i}\n\t==> ${lines[i]}`);
				return {index: i, obj: "", message: 'No operand', line: line};
			}
			let reg:string = operands[0];
			let regn:number | undefined = 0;
			let bit:number = parseInt(operands[1], 10);
			if(bit != 1 && bit != 0){
				console.log(`Invalid Bit Number (${bit}) at line ${i + 1}\n\t==>${lines[i]}\n`);
				return {index: i, obj: `${bit}`, message: 'Invalid Bit Number', line: line};
			}

			if((regn = getItem(equ_const, reg)) != undefined){
				instruction = 0b001011000000 | (bit << 5) | regn;
			} else {
				let val:number | undefined = eLiteral(operands[0]);
				if(val != undefined){
					instruction = 0b001011000000 | (bit << 5) | val;
				} else {
					console.log(`Invalid operands at line (${i + 1})\n\t==>${lines[i]}`)
					return {index: i, obj: "", message: 'Invalid operands', line: line};
				}
			}



		} else if(opcode == "INCF"){
			if(operands[0] == undefined || operands[1] == undefined){
				console.log(`No operand at line ${i + i}\n\t==> ${lines[i]}`);
				return {index: i, obj: "", message: 'No operand', line: line};
			}
			let reg:string = operands[0];
			let regn:number | undefined = 0;
			let bit:number = parseInt(operands[1], 10);
			if(bit != 1 && bit != 0){
				console.log(`Invalid Bit Number (${bit}) at line ${i + 1}\n\t==>${lines[i]}\n`);
				return {index: i, obj: `${bit}`, message: 'Invalid Bit Number', line: line};
			}
			if((regn = getItem(equ_const, reg)) != undefined){
				instruction = 0b001010000000 | (bit << 5) | regn;
			} else {
				let val:number | undefined = eLiteral(operands[0]);
				if(val != undefined){
					instruction = 0b001010000000 | (bit << 5) | val;
				} else {
					console.log(`Invalid operands at line (${i + 1})\n\t==>${lines[i]}`)
					return {index: i, obj: "", message: 'Invalid operands', line: line};
				}
			}


		} else if(opcode == "INCFSZ"){
			if(operands[0] == undefined || operands[1] == undefined){
				console.log(`No operand at line ${i + i}\n\t==> ${lines[i]}`);
				return {index: i, obj: "", message: 'No operand', line: line};
			}
			let reg:string = operands[0];
			let regn:number | undefined = 0;
			let bit:number = parseInt(operands[1], 10);
			if(bit != 1 && bit != 0){
				console.log(`Invalid Bit Number (${bit}) at line ${i + 1}\n\t==>${lines[i]}\n`);
				return {index: i, obj: `${bit}`, message: 'Invalid Bit Number', line: line};
			}
			if((regn = getItem(equ_const, reg)) != undefined){
				instruction = 0b001111000000 | (bit << 5) | regn;
			} else {
				let val:number | undefined = eLiteral(operands[0]);
				if(val != undefined){
					instruction = 0b001111000000 | (bit << 5) | val;
				} else {
					console.log(`Invalid operands at line (${i + 1})\n\t==>${lines[i]}`)
					return {index: i, obj: "", message: 'Invalid operands', line: line};
				}
			}

		} else if(opcode == "BTFSS"){
			if(operands[0] == undefined || operands[1] == undefined){
				console.log(`No operand at line ${i + i}\n\t==> ${lines[i]}`);
				return {index: i, obj: "", message: 'No operand', line: line};
			}
			let reg:string = operands[0];
			let regn:number | undefined = 0;
			let bit:number = parseInt(operands[1], 10);

			if((regn = getItem(equ_const, reg)) != undefined){
				instruction = 0b011000000000 | (bit << 5) | regn;
			} else {
				let val:number | undefined = eLiteral(operands[0]);
				if(val != undefined){
					instruction = 0b011000000000 | (bit << 5) | val;
				} else {
					console.log(`Invalid operands at line (${i + 1})\n\t==>${lines[i]}`)
					return {index: i, obj: "", message: 'Invalid operands', line: line};
				}
			}


		} else if(opcode == "BTFSC"){
			if(operands[0] == undefined || operands[1] == undefined){
				console.log(`No operand at line ${i + i}\n\t==> ${lines[i]}`);
				return {index: i, obj: "", message: 'No operand', line: line};
			}
			let reg:string = operands[0];
			let regn:number | undefined = 0;
			let bit:number = parseInt(operands[1], 10);

			if((regn = getItem(equ_const, reg)) != undefined){
				instruction = 0b011100000000 | (bit << 5) | regn;
			} else {
				let val:number | undefined = eLiteral(operands[0]);
				if(val != undefined){
					instruction = 0b011100000000 | (bit << 5) | val;
				} else {
					console.log(`Invalid operands at line (${i + 1})\n\t==>${lines[i]}`)
					return {index: i, obj: "", message: 'Invalid operands', line: line};
				}
			}


		} else if(opcode == "GOTO"){
			let label:string = operands[0];
			let address:number = 0;
			if(getItem(labels, label) == undefined){
				console.log(`Label name (${label}) not found at line (${i + i})\n\t==> ${lines[i]}`);
				return {index: i, obj: label, message: 'Label name not found', line: line};
			} else {
				address = getItem(labels, label) as number;
			}

			instruction = 0b101000000000 | address;


		} else if (opcode == "NOP"){
			instruction = 0b000000000000;

		} else {
			console.log(`Invalid opcode: ${opcode}`);
			return {index: i, obj: opcode, message: "Invalid Opcode", line: line};
		}

		console.log(`${line.padEnd(18)} | 0b${instruction.toString(2).padStart(12, '0')}`);
		machineCode.push({
			line: line,
			value: instruction,
			binary: `0b${instruction.toString(2).padStart(12, '0')}`,
			total: `${line.padEnd(15)}0b${instruction.toString(2).padStart(12, '0')}`
			});
		
	}

	// console.log(`\n\n\tEQU CONST: ${[...equ_const.entries()]}`);
	// console.log(`\tLabels: ${[...labels.entries()]}`);


	// Create String Output
	console.log(`\n\nMachine Code as int:`);
	let outString:string = "int program[] = {";
	for(let i = 0; i < machineCode.length; i++){
		if(i != machineCode.length - 1){
			outString += `${machineCode[i]}, `;
		} else {
			outString += `${machineCode[i]}`;
		}
	}
	outString += "};";
	console.log(outString);

	return machineCode;
}



function intToBinary(decimal: number): string {
	const binaryString = decimal.toString(2);
	const paddedBinaryString = binaryString.padStart(12, '0');
	return `0b${paddedBinaryString}`;
}


function translateEvent(){

	let data:string = (<HTMLInputElement>document.getElementById("editor")).value;

	let result:Array<Line> | ErrOut = assembler(data);
	let viewData:string = "int program[] = {";
	let resultData:string = "";

	if(typeof result === 'object' && !("index" in result)){
		for(let i = 0; i < result.length; ++i){
			if(i != result.length - 1){
				viewData += `${result[i].value}, `;
			} else {
				viewData += `${result[i].value}`;
			}
			resultData  += `${result[i].total}\n`
		}
	} else {
		resultData += `${result.message} `;
		resultData += `(${result.index + 1}) `;
		if(result.obj != ""){
			resultData += `[${result.obj}]\n\n`
		} else {
			resultData += `\n\n`
		}
		resultData += `${result.line}`
	}

	viewData += "};";

	(document.getElementById("arrayView") as HTMLInputElement).value = viewData;
	(document.getElementById("resultView") as HTMLInputElement).value = resultData;
}


let asm_file:string = `
GPIO EQU 0x06
start:
	BSF 06H, 0  ; Bit Set Forward
	NOP         ; No Operation
	NOP
	MOVLW 'H'
	BCF 06H, 0  ; Bit Clear File
	GOTO start  ; GOTO
`; 

function setIdx(inpt:string, idx:number, ch:string): string{
	let l = inpt.split("")
	l[idx] = ch;
	return l.join("");
}


function assembler(data:string): Array<number> {
	let lines:Array<string> = data.split("\n");
	let machineCode:Array<number> = [];

	let labels:Array<string> = [];
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
			console.log(`LABEL: ${label}`);
			if(labels.includes(label)){
				console.log(`Duplicate label: (${label}) at line (${i + 1})\n\t==> ${lines[i]}`)
			} else {
				labels.push(label);
			}
			continue;
		}

		// Search For EQU constant
		if(line.indexOf("EQU") >= 0){
			let parts:Array<string> = line.split(" ");
			console.log(`PARTS: ${parts}`);
			if(parts.length != 3){
				console.log(`Invalid EQU line: ${line} at line ${i + 1}\n\t==> ${lines[i]}`);
			} else {
				// equ_const[parts[0]] = parseInt(parts[2], 16);
				// console.log(`\n\nNAME: ${parts[0]}\nValue: ${parseInt(parts[2], 16)}\n\n`)
				equ_const.set(parts[0], parseInt(parts[2], 16));
			}
			continue;
		}


		let parts:Array<string> = line.split(RegExp(" +"));
		let opcode:string = parts[0];
		let operands:Array<string> = parts.slice(1);

		// console.log(`OPERANDS: ${operands} | ${operands.length}`);

		console.log(`${i} > ${line}`);

	}

	console.log(`EQU CONST: ${[...equ_const.entries()]}`);

	return machineCode;
}

assembler(asm_file);

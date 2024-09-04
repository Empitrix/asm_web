let file:string = `
start:
	BSF 06H, 0
	NOP
	BCF 06H, 0
	GOTO start
`; 

function printLines(){
	let i:number = 0;
	let lines:Array<string> = file.split("\n");

	for(i = 0; i < lines.length; i++){
		console.log(`${i + i}| ${lines[i]}`);
	}
}

printLines();

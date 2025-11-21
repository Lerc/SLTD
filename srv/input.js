function initInput(){
	"use strict"
	window.usingTouch=false;
	let touchCountDown=0;

	let keyboardState = {};
  let keysDown = {};

	let touchKeyState = {};
	let touchKeysDown = {};
	
document.addEventListener('keydown', keyDownHandler);
document.addEventListener('keyup', keyUpHandler);

document.addEventListener("mousedown", mouseDownHandler) 
document.addEventListener("mouseup", mouseUpHandler) 


function keyDownHandler(event) {
	keyboardState[event.keyCode] = true;
	keysDown[event.keyCode] = true;
}

function keyUpHandler(event) {
	keyboardState[event.keyCode] = false;
}

function mouseDownHandler(event) {
	keyboardState[133+event.button] = true;
	keysDown[133+event.button] = true;
}

function mouseUpHandler(event) {
	keyboardState[133+event.button] = false;
}

function isKeyDown(keyCode) {
	return (keyboardState[keyCode] ? true : false) ||
				 (touchKeyState[keyCode] ? true : false)
		  ;
}

function keyWentDown(keyCode) {
	return (keysDown[keyCode] ? true : false) ||
	       (touchKeysDown[keyCode] ? true : false);
}

function flushKeysDown() {
	keysDown = {};
	touchKeysDown = {};
	if (touchCountDown>0) {
		touchCountDown-=1;
	}
	window.usingTouch=(touchCountDown>0);
}

let mainElement=document.querySelector("#main");

mainElement.addEventListener("touchstart", touchStartHandler);
mainElement.addEventListener("touchend", touchEndHandler);
mainElement.addEventListener("touchcancel", touchEndHandler);
mainElement.addEventListener("touchmove", touchMoveHandler);

function localCoordinates({x, y}) {
	//assuming main element is a canvas;
	let canvas=mainElement;
	let ox = 0;
	let oy = 0;
	let actualHeight = canvas.clientHeight;
	let actualWidth = canvas.clientWidth;
	if (document.fullscreenElement == canvas) {
		//need to do do shenanigans to handle canvas indent
		let w = canvas.width;
		let h = canvas.height
		let cw = canvas.clientWidth;
		let ch = canvas.clientHeight;

		if (w/h > cw/ch) {
			actualHeight=(cw/w*h);
			oy= (ch-actualHeight)/2;
		} else {
			actualWidth=(ch/h*w);
			ox= (cw-actualWidth)/2;
		}
	}

	x-=ox+canvas.offsetLeft;
	y-=oy+canvas.offsetTop;

	x = x/actualWidth * canvas.width;
	y = y/actualHeight * canvas.height;
	
	return vscale({x,y},1/globalScaleFactor)
}
window.screenToCanvas=localCoordinates;

window.touchList=[];

function wasdTouch(touch) {

	let [dx,dy]=vdiff(touch,v2(200,900));
	
	//note=JSON.stringify({dx,dy});

	if (vlength(v2(dx,dy)) > 300) return [];
	if (vlength(v2(dx,dy)) < 50) return [];

	result =[];

	if (dy<-25) result.push(87);
	if (dy>25) result.push(83); 
	if (dx<-25) result.push(65);
	if (dx>25) result.push(68);

	return result;
}

function touchButton(keyCode,pos,radius) {
	return touch=>vdistance(pos,touch)<radius?[keyCode]:[];
}
let touchMappers =[];// wasdTouch,touchButton(32,v2(0,0),200), touchButton(69,v2(1820,980),100)];

function flatten(array) {  //there's a method for this, except for edge.
	return array.reduce( (a,v)=>a.concat(v),[]);
	
}

var mainTouch = null;

function touchStartHandler(e){
	window.touchList=e.touches;	
	e.preventDefault();

	for (let touch of e.changedTouches) {
		let pos = localCoordinates(v2(touch.clientX,touch.clientY));		
		if (!mainTouch) {
			mainTouch=touch.identifier;
			pressStart(pos);
		}
		let keyCodes = touchMappers.map(a=>a(pos));
		setMousePos(pos);
		keysDown[133] = true;
		//note=JSON.stringify(pos);
		flatten(keyCodes).forEach(a=>touchKeysDown[a]=true);
 	}

/*
	touchKeyState={};
	for (let touch of e.touches) {
		let pos = localCoordinates([touch.clientX,touch.clientY]);

		let keyCodes = touchMappers.map(a=>a(pos));
		for (let keyCode of flatten(keyCodes)) {
			touchKeyState[keyCode]=true;
		}
	}
	*/
	touchCountDown=200;
}

function touchMoveHandler(e){
	for (let touch of e.touches) {
		let pos = localCoordinates(v2(touch.clientX,touch.clientY));
		setMousePos(pos);
		if (touch.identifier == mainTouch) {
			pressMove(pos);
		}
	}
}	

function touchEndHandler(e){
	touchCountDown=200;
	window.touchList=e.touches;

	touchKeyState={};
	for (let touch of e.changedTouches) {
		let pos = localCoordinates(v2(touch.clientX,touch.clientY));
		if (touch.identifier == mainTouch) {
			mainTouch=null;
			pressEnd(pos);
		}


		let keyCodes = touchMappers.map(a=>a(pos))		

		for (let keyCode of flatten(keyCodes)) {
			touchKeyState[keyCode]=true;
		}
 	}

	e.preventDefault();
}

window.Input = {
	isKeyDown,
	keyWentDown,
	flushKeysDown
};

};



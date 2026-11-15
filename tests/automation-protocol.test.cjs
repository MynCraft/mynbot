const path = require('node:path');
const assert = require('node:assert/strict');
const { fork } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const mc = require(path.join(root, 'node_modules/minecraft-protocol'));
const mcData = require(path.join(root, 'node_modules/minecraft-data'))('1.16.5');
const Item = require(path.join(root, 'node_modules/prismarine-item'))('1.16.5');
const server = mc.createServer({ host: '127.0.0.1', port: 0, version: '1.16.5', 'online-mode': false, keepAlive: false });
let worker, peer, ate = false;
const messages = [];
const wait = (predicate, label, timeout=12000) => new Promise((resolve,reject) => {
 const start=Date.now(); const t=setInterval(()=>{if(predicate()){clearInterval(t);resolve();}else if(Date.now()-start>timeout){clearInterval(t);reject(Error('Timeout: '+label));}},40);
});
server.on('login', client => {
 console.log('server login',client.username);
 peer=client;
 client.write('login', {...mcData.loginPacket, entityId:client.id, isHardcore:false, gameMode:0, previousGameMode:1, hashedSeed:[0,0], maxPlayers:4, viewDistance:4, reducedDebugInfo:false, enableRespawnScreen:true, isDebug:false, isFlat:false});
 client.write('position', {x:0,y:64,z:0,yaw:0,pitch:0,flags:0,teleportId:1});
 setTimeout(()=>{
  if(client.state!=='play')return;
  client.write('update_health',{health:20,food:10,foodSaturation:0});
  client.write('set_slot',{windowId:0,slot:36,item:Item.toNotch(new Item(mcData.itemsByName.cooked_beef.id,4))});
  client.write('chat',{message:JSON.stringify({text:'Local test ready'}),position:0,sender:'00000000-0000-0000-0000-000000000000'});
 },250);
 client.on('use_item', () => { ate = true; client.write('update_health',{health:20,food:20,foodSaturation:10}); client.write('entity_status',{entityId:client.id,entityStatus:9}); });
 client.on('chat', ({message})=>client.write('chat',{message:JSON.stringify({text:'echo:'+message}),position:0,sender:'00000000-0000-0000-0000-000000000000'}));
});
server.on('error', e=>{ console.error(e);process.exitCode=1; });
server.on('listening',async()=>{
 try{
  worker=fork(path.join(root,'public/bot-worker.cjs'),[],{execPath:process.execPath,silent:true});
  worker.on('message',m=>{messages.push(m);if(['status','automation'].includes(m.type))console.log('worker',JSON.stringify(m));}); worker.stderr.on('data',b=>process.stderr.write(b));
  worker.send({action:'connect',bot:{username:'LocalTest',host:'127.0.0.1',port:server.socketServer.address().port,version:'1.16.5'},plugins:{autoEat:{enabled:true,hungerThreshold:16,healthThreshold:10,selection:'saturation',allowGoldenApples:false,restoreHeldItem:true}}});
  await wait(()=>messages.some(m=>m.state==='connected'),'spawn');
  await wait(()=>messages.some(m=>m.type==='inventory'&&m.inventory.some(i=>i.slot===36&&i.name==='cooked_beef'&&i.count===4)),'inventory diamond');
  await wait(()=>messages.some(m=>m.type==='chat'&&m.text==='Local test ready'),'server chat');
  await wait(()=>ate && messages.some(m=>m.type==='automation'&&m.automation.autoEat?.lastRunAt),'native consume and completion status');
  worker.send({action:'chat',username:'LocalTest',message:'hello'});
  await wait(()=>messages.some(m=>m.type==='chat'&&m.text==='echo:hello'),'outgoing chat roundtrip');
  let held=-1;peer.on('held_item_slot', p=>{held=p.slotId;});
  worker.send({action:'slot',username:'LocalTest',slot:2});
  await wait(()=>held===2&&messages.some(m=>m.type==='inventory'&&m.selectedSlot===2),'hotbar roundtrip');
  worker.send({action:'disconnect',username:'LocalTest'});
  await wait(()=>messages.some(m=>m.state==='disconnected'),'disconnect');
  assert(messages.some(m=>m.type==='inventory'));
  console.log('PASS: real local Minecraft 1.16.5 protocol server -> spawn, cooked_beef inventory, native consume packet, completion status, chat, manual hotbar, disconnect');
 }catch(e){console.error(e);process.exitCode=1;}
 finally{worker?.kill();server.close();setTimeout(()=>process.exit(process.exitCode||0),150);}
});

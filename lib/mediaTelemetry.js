const {randomUUID}=require('node:crypto');
const {performance}=require('node:perf_hooks');
const {recordMedia}=require('./analytics');
const providers=new Set(['knight','hector','prince','prexzy','eliteprotech','yupra','okatsu','izumi','keith','render','local']);
const elapsed=start=>Math.min(86400000,Math.max(0,Math.round(performance.now()-start)));
function createOperation(mediaKind){
 const operationId=randomUUID(), start=performance.now(); let finished=false, winner='none';
 return {
  attempt(name){const provider=String(name).toLowerCase(); const eventId=randomUUID(), t=performance.now(); let done=false;
   return (success)=>{if(done)return;done=true;if(!providers.has(provider))return;if(success)winner=provider;recordMedia('provider-attempts',{operationId,provider,mediaKind,success,durationMs:elapsed(t),...(!success?{errorCode:'PROVIDER_FAILED'}:{})},eventId);};
  },
  finish(success,errorCode='DOWNLOAD_FAILED'){if(finished)return;finished=true;recordMedia('media-operations',{operationId,provider:winner,mediaKind,success,durationMs:elapsed(start),...(!success?{errorCode}:{})},operationId);}
 };
}
module.exports={createOperation};

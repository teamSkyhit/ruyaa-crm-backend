const http = require('http');
const BASE = 'http://localhost:8000/api';
function req(path, opts={}) {
  return new Promise((resolve,reject)=>{
    const url = new URL(BASE+path);
    const o = { hostname:url.hostname, port:url.port||80, path:url.pathname+url.search, method:opts.method||'GET', headers:{'Content-Type':'application/json',...(opts.headers||{})} };
    const r = http.request(o, res=>{ let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{resolve({s:res.statusCode,b:JSON.parse(d)})}catch(e){resolve({s:res.statusCode,b:d})} }); });
    r.on('error',reject); if(opts.body) r.write(opts.body); r.end();
  });
}
async function run() {
  const lr = await req('/auth/login',{method:'POST',body:JSON.stringify({email:'admin@unitrack.local',password:'Admin@123'})});
  const H = {Authorization:'Bearer '+lr.b.data.token};
  const stores = await req('/stores',{headers:H});
  const storeId = stores.b.data[0].id;
  console.log('Store ID:', storeId);
  const cr = await req('/users',{method:'POST',headers:H,body:JSON.stringify({name:'Debug User',email:'debug-'+Date.now()+'@x.com',password:'Test@1234',storeId})});
  console.log('Create response status:', cr.s);
  console.log('Create response data:', JSON.stringify(cr.b.data, null, 2));
}
run().catch(console.error);

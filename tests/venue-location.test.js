import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { validVenueCoordinates } from '../shared/venue-location.js';
const b = await build({entryPoints:['src/lib/venueLocation.ts','src/lib/venues.ts'],bundle:true,format:'esm',platform:'node',outdir:'out',write:false});
const modules = await Promise.all(b.outputFiles.map(f=>import('data:text/javascript;base64,'+Buffer.from(f.text).toString('base64'))));
const {venueLocation}=modules.find(m=>m.venueLocation);
const {SPB_VENUES}=modules.find(m=>m.SPB_VENUES);
test('all seed venues have real finite coordinates in Petersburg region',()=>{
 for(const venue of SPB_VENUES){const p=venueLocation(venue);assert.ok(p,venue.id);assert.ok(p.lat>59.6&&p.lat<60.3&&p.lng>29.4&&p.lng<31,venue.id);}
});
test('administrator coordinates win; changed address and unknown venue never inherit invented point',()=>{
 const v=SPB_VENUES[0];assert.deepEqual(venueLocation({...v,coordinates:{lat:60,lng:30}}),{lat:60,lng:30});
 assert.equal(venueLocation({...v,address:'Другой адрес'}),null);
 assert.equal(venueLocation({...v,id:'new-venue'}),null);
});
test('coordinates reject nulls, strings, NaN, infinity and impossible latitude',()=>{
 for(const p of [null,{}, {lat:null,lng:null},{lat:'60',lng:'30'},{lat:NaN,lng:30},{lat:Infinity,lng:30},{lat:91,lng:30},{lat:60,lng:181}])assert.equal(validVenueCoordinates(p),false);
 assert.equal(validVenueCoordinates({lat:0,lng:0}),true);
});

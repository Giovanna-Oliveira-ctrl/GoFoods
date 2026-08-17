/* GoFoods — service worker
   Guarda a "casca" do app para abrir rápido e funcionar offline.
   Os dados vêm sempre do Supabase pela rede: nada de pedido é
   servido do cache, para ninguém ver informação desatualizada. */

const CACHE = 'gofoods-shell-v1';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e)=>{
  e.waitUntil(
    caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', (e)=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', (e)=>{
  const req = e.request;
  if(req.method !== 'GET') return;

  const url = new URL(req.url);
  // Chamadas ao Supabase (dados e tempo real) nunca passam pelo cache.
  if(url.hostname.endsWith('.supabase.co')) return;

  // Navegação: tenta a rede primeiro para pegar versões novas do app,
  // e cai para o cache quando estiver sem internet.
  if(req.mode === 'navigate'){
    e.respondWith(
      fetch(req)
        .then(res=>{
          const copy = res.clone();
          caches.open(CACHE).then(c=>c.put('./index.html', copy));
          return res;
        })
        .catch(()=>caches.match('./index.html'))
    );
    return;
  }

  // Demais arquivos: cache primeiro, atualizando em segundo plano.
  e.respondWith(
    caches.match(req).then(hit=>{
      const net = fetch(req).then(res=>{
        if(res && res.status === 200 && res.type === 'basic'){
          const copy = res.clone();
          caches.open(CACHE).then(c=>c.put(req, copy));
        }
        return res;
      }).catch(()=>hit);
      return hit || net;
    })
  );
});

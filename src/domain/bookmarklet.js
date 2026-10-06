// The "Save to VGC Builder" bookmarklet. On a finished Showdown battle it presses Showdown's own
// "Upload and share replay" button, waits for the replay link, then opens our import page.
// It sends nothing itself and holds no secrets: our server fetches the replay from Showdown.

const POLL_MS = 300;
const MAX_POLLS = 20; // ~6s for Showdown to finish uploading

/** Bookmarklet source for a site at `origin` (e.g. "https://vgc.builder"). */
export function buildBookmarklet(origin) {
  const importUrl = JSON.stringify(`${origin}/?import=`);
  return 'javascript:(()=>{' +
    "const room=location.pathname.slice(1);" +
    "if(!room.startsWith('battle-')){alert('Open a finished Showdown battle first.');return}" +
    "const id=room.slice(7);" +
    "document.querySelector('button[name=saveReplay]')?.click();" +
    'let polls=0;' +
    'const timer=setInterval(()=>{' +
    "const link=[...document.querySelectorAll('a[href*=\"replay.pokemonshowdown.com/\"]')].find(a=>a.href.includes(id));" +
    `if(link||++polls>${MAX_POLLS}){clearInterval(timer);location.href=${importUrl}+encodeURIComponent(link?link.href:id)}` +
    `},${POLL_MS})})()`;
}

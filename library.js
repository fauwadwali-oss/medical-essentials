const cards = [...document.querySelectorAll('.library-card')];
const search = document.querySelector('#video-search');
const buttons = [...document.querySelectorAll('[data-library-track]')];
const more = document.querySelector('#load-more');
let track = 'all', limit = 24;
const normalize = value => value.normalize('NFKC').toLocaleLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/ي/g,'ی').replace(/ك/g,'ک').trim();
function update() {
 const query = normalize(search.value);
 const matches = cards.filter(card => (track === 'all' || card.dataset.track === track) && normalize(card.dataset.title).includes(query));
 const shown = new Set(matches.slice(0,limit));
 cards.forEach(card => {card.hidden = !shown.has(card);});
 document.querySelector('#library-status').textContent = `${matches.length} میں سے ${Math.min(limit,matches.length)} ویڈیوز`;
 document.querySelector('#library-empty').hidden = matches.length > 0;
 more.hidden = matches.length <= limit;
}
search.addEventListener('input',()=>{limit=24; update();});
buttons.forEach(button=>button.addEventListener('click',()=>{
 track=button.dataset.libraryTrack; limit=24;
 buttons.forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));}); update();
}));
more.addEventListener('click',()=>{
 const shown = new Set(cards.filter(card=>!card.hidden));
 limit+=24; update();
 const firstNew=cards.find(card=>!card.hidden&&!shown.has(card));
 firstNew?.querySelector('a')?.focus({preventScroll:true});
});
update();

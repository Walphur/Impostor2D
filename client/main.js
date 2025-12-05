(function(){
  const screenHome = document.getElementById('screen-home');
  const screenLocal = document.getElementById('screen-local');
  const screenOnline = document.getElementById('screen-online');

  function show(screen){
    [screenHome, screenLocal, screenOnline].forEach(el=>{
      el.classList.remove('screen--active');
    });
    screen.classList.add('screen--active');
  }

  document.getElementById('btn-home-local').addEventListener('click', ()=>{
    show(screenLocal);
  });
  document.getElementById('btn-home-online').addEventListener('click', ()=>{
    show(screenOnline);
  });
  document.getElementById('btn-back-from-local').addEventListener('click', ()=>{
    show(screenHome);
  });
  document.getElementById('btn-back-from-online').addEventListener('click', ()=>{
    show(screenHome);
  });

  // start on home
  show(screenHome);
})();

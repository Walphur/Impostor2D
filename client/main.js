(function(){
  const screenHome   = document.getElementById('screen-home');
  const screenLocal  = document.getElementById('screen-local');
  const screenOnline = document.getElementById('screen-online');

  const btnLocal  = document.getElementById('btn-home-local');
  const btnOnline = document.getElementById('btn-home-online');

  const btnBackLocal  = document.getElementById('btn-back-from-local');
  const btnBackOnline = document.getElementById('btn-back-from-online');

  function show(screen){
    [screenHome, screenLocal, screenOnline].forEach(el=>{
      el.classList.remove('screen--active');
    });
    screen.classList.add('screen--active');
  }

  function setModeActive(mode){
    btnLocal.classList.toggle('btn-mode-active', mode === 'local');
    btnOnline.classList.toggle('btn-mode-active', mode === 'online');
  }

  btnLocal.addEventListener('click', ()=>{
    show(screenLocal);
    setModeActive('local');
  });

  btnOnline.addEventListener('click', ()=>{
    show(screenOnline);
    setModeActive('online');
  });

  btnBackLocal.addEventListener('click', ()=>{
    show(screenHome);
    setModeActive('local');
  });

  btnBackOnline.addEventListener('click', ()=>{
    show(screenHome);
    setModeActive('local');
  });

  // inicio
  show(screenHome);
  setModeActive('local');
})();

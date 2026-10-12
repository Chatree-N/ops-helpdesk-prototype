/* Hash router: store state <-> location.hash. Deep links work on any static host. */
(function(){
  var M=window.__storeModule, st=M.store;
  var BASIC=['inbox','kanban','dashboard'];
  function hashOf(s){
    var r=s.route;
    if(r==='portal')return '#/portal';
    if(r==='settings')return '#/settings/'+s.settingsPage;
    if(r==='ticket')return '#/ticket/'+encodeURIComponent(s.detailId||'');
    if(r==='dealer')return '#/dealer/'+encodeURIComponent(s.dealerId||'');
    if(r==='article')return '#/article/'+encodeURIComponent(s.kbArticleId||'');
    if(s.ticketType==='Onboarding'&&BASIC.indexOf(r)>=0)return '#/onboarding'+(r==='kanban'?'':'/'+r);
    return '#/'+r;
  }
  function apply(){
    var p=location.hash.replace(/^#\/?/,'').split('/').filter(Boolean).map(decodeURIComponent);
    if(!p.length)return;
    var s=st.get();
    if(hashOf(s)===location.hash)return;
    var a=p[0],b=p[1];
    if(BASIC.indexOf(a)>=0){if(s.ticketType!=='Support')st.setType('Support');st.setRoute(a);}
    else if(a==='onboarding'){if(s.ticketType!=='Onboarding')st.setType('Onboarding');st.setRoute(BASIC.indexOf(b)>=0?b:'kanban');}
    else if(a==='kb')st.setRoute('kb');
    else if(a==='help')st.setRoute('help');
    else if(a==='portal')st.openPortal();
    else if(a==='settings'){st.setSettingsPage(b==='automations'?'automations':'integrations');st.setRoute('settings');}
    else if(a==='ticket'&&b){if(s.ticketType!=='Support')st.setType('Support');st.openTicket(b);}
    else if(a==='dealer'&&b){if(s.ticketType!=='Onboarding')st.setType('Onboarding');st.openDealer(b);}
    else if(a==='article'&&b){st.openArticle(b);}
  }
  window.addEventListener('hashchange',apply);
  st.subscribe(function(s){var h=hashOf(s);if(location.hash!==h)location.hash=h;});
  if(location.hash)apply();else history.replaceState(null,'',hashOf(st.get()));
})();

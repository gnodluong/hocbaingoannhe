'use strict';
function buildThemeSwitcher(App) {
  const themes=document.getElementById('theme-switcher');
  const extra=[['ocean','Xanh biển'],['teal','Xanh ngọc'],['amber','Hổ phách'],['rose','Hồng mận']];
  const palette=el('div',{class:'theme-palette',attrs:{id:'theme-palette-menu',popover:'auto',role:'dialog','aria-label':'Giao diện mở rộng'}});
  palette.append(el('div',{class:'theme-palette-title',text:'Màu nền tối'}));
  const choices=el('div',{class:'theme-palette-choices'});palette.append(choices);document.body.append(palette);
  const more=el('button',{class:'theme-more',text:'Mở rộng',attrs:{id:'theme-more',type:'button','aria-haspopup':'dialog','aria-expanded':'false','aria-controls':'theme-palette-menu'},on:{click:()=>{
    if(palette.matches(':popover-open')){palette.hidePopover();return;}
    placePalette();palette.showPopover();
    (palette.querySelector('[aria-pressed="true"]')||palette.querySelector('button')).focus({preventScroll:true});
  }}});
  function placePalette(){
    const r=more.getBoundingClientRect();
    palette.style.left=Math.max(12,Math.min(r.right-300,innerWidth-312))+'px';
    palette.style.top=Math.max(48,r.bottom+8)+'px';
  }
  palette.addEventListener('toggle',()=>more.setAttribute('aria-expanded',String(palette.matches(':popover-open'))));
  window.addEventListener('resize',()=>{if(palette.matches(':popover-open'))placePalette();});
  // Only activation keys belong to the toolbar; other quiz shortcuts still work.
  themes.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')event.stopPropagation();});
  // The open palette owns its keyboard events; Escape dismisses it natively.
  palette.addEventListener('keydown',event=>event.stopPropagation());
  // Shift+Tab may leave this nonmodal popover; Escape must still dismiss only it.
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&palette.matches(':popover-open'))event.stopPropagation();
  },true);
  const buttons=[];
  const updateTheme=value=>{
    document.documentElement.dataset.theme=value;
    buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.theme===value)));
    const selected=extra.find(([id])=>id===value);
    more.dataset.active=String(!!selected);
    more.title=selected?'Đang dùng '+selected[1]:'Thêm màu nền tối';
    more.setAttribute('aria-label',selected?'Mở rộng, đang dùng '+selected[1]:'Mở rộng, thêm màu nền tối');
  };
  for(const [value,label] of [['light','Sáng'],['dark','Tối'],['purple','Tím'],...extra]) {
    const button=el('button',{class:'theme-choice',text:label,attrs:{type:'button','data-theme':value,'aria-pressed':'false',title:'Giao diện '+label.toLowerCase()},on:{click:async()=>{
      const focused=document.activeElement;
      [...buttons,more].forEach(b=>b.disabled=true);
      try {updateTheme(await App.api.theme.set(value));if(palette.matches(':popover-open'))palette.hidePopover();}
      catch(err){console.error(err);toast('Chưa lưu được giao diện. Anh thử lại nhé.','bad');}
      finally {
        [...buttons,more].forEach(b=>b.disabled=false);
        (palette.contains(focused)&&!palette.matches(':popover-open')?more:focused)?.focus();
      }
    }}});
    buttons.push(button);
    if(extra.some(([id])=>id===value)){
      button.classList.add('theme-palette-choice');
      button.prepend(el('span',{class:'theme-swatch '+value,attrs:{'aria-hidden':'true'}}));
      button.append(el('span',{class:'theme-choice-check',html:icon('check',14),attrs:{'aria-hidden':'true'}}));
      choices.append(button);
    }else themes.append(button);
  }
  themes.append(more);
  updateTheme(App.api.initialTheme);
}

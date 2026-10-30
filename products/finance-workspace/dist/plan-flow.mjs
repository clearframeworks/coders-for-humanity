// Presentation-only staged editor. Financial state is committed by app.mjs.
export function mountPlanFlow({root=document}={}) {
  const dialog=root.querySelector('#plan-dialog'),form=root.querySelector('#plan-form');
  const labels=['Balances','Income','Bills','Everyday & review'];
  const heading=dialog.querySelector('h2');heading.id='plan-title';dialog.setAttribute('aria-labelledby','plan-title');
  const grid=form.querySelector('.field-grid'),fields=[...form.querySelectorAll(':scope > fieldset')];
  const groups=[[grid,fields[0]],[fields[1]],[fields[2]],[fields[3]]];
  let current=0,resumable=false,freshMode=false;
  const nav=root.createElement('nav');nav.className='plan-step-nav';nav.setAttribute('aria-label','Plan steps');
  const progress=root.createElement('p');progress.className='plan-step-progress';progress.setAttribute('aria-live','polite');
  form.querySelector('.dialog-intro').after(nav,progress);
  const steps=groups.map((elements,index)=>{
    const section=root.createElement('section');section.className='plan-step';section.dataset.step=index;
    const title=root.createElement('h3');title.tabIndex=-1;title.textContent=labels[index];section.append(title);
    elements[0].before(section);for(const element of elements)section.append(element);
    const button=root.createElement('button');button.type='button';button.dataset.planStep=index;button.textContent=`${index+1}. ${labels[index]}`;
    button.addEventListener('click',()=>{if(index<current||validateThrough(index-1))show(index);});nav.append(button);
    return section;
  });
  const emptyNotes=['','No expected income yet? Continue and add it later. Only the paydays you enter are counted.','No bills to enter yet? Continue and add them later. Omitted costs are not in your forecast.'];
  for(const index of [1,2]){const note=root.createElement('p');note.className='plan-help';note.textContent=emptyNotes[index];steps[index].append(note);}
  const review=root.createElement('div');review.className='plan-review';steps[3].append(review);
  const actions=form.querySelector('.dialog-actions');actions.classList.add('plan-flow-actions');
  const back=root.createElement('button');back.type='button';back.className='button';back.textContent='Back';back.id='plan-back';back.onclick=()=>show(current-1);
  const next=root.createElement('button');next.type='button';next.className='button primary';next.textContent='Continue';next.id='plan-next';next.onclick=()=>{if(validateStep(current))show(current+1);};
  const save=form.querySelector('[type=submit]');save.textContent='Save my plan';save.id='plan-save';actions.prepend(back);actions.append(next);
  const error=root.querySelector('#plan-error');error.setAttribute('aria-live','assertive');
  form.noValidate=true;
  function updateReview(){
    const accounts=[...root.querySelectorAll('#account-rows [name=accountBalance]')];
    const balance=accounts.reduce((sum,input)=>sum+Math.round(Number(input.value||0)*100),0)/100;
    const currency=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
    review.replaceChildren();const title=root.createElement('h3');title.textContent='Before you save';review.append(title);
    const rows=[['Starting funds',currency(balance)],['Balance date',form.elements.startDate.value],['Income schedules',String(root.querySelector('#paycheck-rows').children.length)],['Bill schedules',String(root.querySelector('#bill-rows').children.length)],['Everyday estimate',`${currency(Number(form.elements.dailySpend.value||0))} / day`],['Cushion to keep',currency(Number(form.elements.cushion.value||0))]];
    const list=root.createElement('dl');for(const [label,value] of rows){const row=root.createElement('div'),dt=root.createElement('dt'),dd=root.createElement('dd');dt.textContent=label;dd.textContent=value;row.append(dt,dd);list.append(row);}review.append(list);
    const note=root.createElement('p');note.textContent='These are forecast inputs. Saving does not move money, connect a bank or change imported transactions.';review.append(note);
  }
  function show(index,focus=true){
    current=Math.max(0,Math.min(3,index));steps.forEach((section,i)=>section.hidden=i!==current);
    [...nav.children].forEach((button,i)=>{if(i===current)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');});
    progress.textContent=`Step ${current+1} of 4 · ${labels[current]}`;
    back.hidden=current===0;next.hidden=current===3;save.hidden=current!==3;
    if(current===3)updateReview();
    if(focus)steps[current].querySelector('h3').focus();
  }
  function validateStep(index){
    if(index===0&&!root.querySelector('#account-rows').children.length){show(0);error.textContent='Add at least one account. A zero balance is fine.';error.hidden=false;root.querySelector('#add-account').focus();return false;}
    for(const input of steps[index].querySelectorAll('input,select')){if(['accountName','name'].includes(input.name))input.setCustomValidity(input.value.trim()?'':'Enter a name.');if(!input.checkValidity()){
      show(index,false);input.setAttribute('aria-invalid','true');input.setAttribute('aria-describedby','plan-error');
      const label=input.closest('label')?.childNodes[0]?.textContent?.trim()||'This field';
      error.textContent=`${label}: ${input.validationMessage}`;error.hidden=false;input.reportValidity();input.focus();return false;
    }}
    error.hidden=true;return true;
  }
  function validateThrough(last){for(let index=0;index<=last;index++)if(!validateStep(index))return false;return true;}
  form.addEventListener('input',event=>{event.target.setCustomValidity?.('');if(event.target.hasAttribute('aria-invalid')){event.target.removeAttribute('aria-invalid');event.target.removeAttribute('aria-describedby');}});
  form.addEventListener('submit',event=>{
    if(current<3){event.preventDefault();event.stopImmediatePropagation();if(validateStep(current))show(current+1);return;}
    if(!validateThrough(3)){event.preventDefault();event.stopImmediatePropagation();}
  },true);
  dialog.addEventListener('close',()=>{if(resumable)form.querySelector('.dialog-intro').textContent='Your draft is kept until you save or reload this page. It has not changed your saved plan.';});
  return {
    resume(fresh){if(!resumable||fresh!==freshMode)return false;dialog.showModal();show(current);return true;},
    open(fresh){freshMode=fresh;resumable=true;form.querySelector('.dialog-intro').textContent='Start with what you know. Nothing is saved until the final step.';show(0,false);},
    focus(){show(current);},
    showStep(index){show(index);},
    saved(){resumable=false;},
    reset(){resumable=false;},
    getStep:()=>current
  };
}

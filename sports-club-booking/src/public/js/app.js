'use strict';
document.querySelectorAll('form[data-confirm]').forEach(form=>form.addEventListener('submit',event=>{if(!window.confirm(form.dataset.confirm))event.preventDefault();}));
document.getElementById('back-button')?.addEventListener('click',()=>window.history.back());
const form=document.getElementById('booking-form');
if(form) {
  let index=0;
  const container=document.getElementById('equipment-items');
  const date=document.getElementById('booking_date');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  date.value=today;
  document.getElementById('add-equipment').addEventListener('click',()=>{
    if(container.children.length>=40)return;
    const fragment=document.getElementById('equipment-template').content.cloneNode(true),row=fragment.querySelector('.rental-item');
    row.querySelectorAll('[data-field]').forEach(input=>{
      input.name=`items[${index}][${input.dataset.field}]`;
      input.id=`item-${index}-${input.dataset.field}`;
      input.parentElement.querySelector('label').htmlFor=input.id;
      if(['rental_date','due_date'].includes(input.dataset.field))input.value=date.value;
    });
    index++;
    row.querySelector('.remove-equipment').addEventListener('click',()=>{row.remove();reindex();});
    row.addEventListener('input',()=>{
      const selected=row.querySelector('[data-field="equipment_id"]').value;
      for(const field of ['quantity','rental_date','due_date'])row.querySelector(`[data-field="${field}"]`).required=!!selected;
      const rate=Number(row.querySelector('select').selectedOptions[0]?.dataset.rate||0),qty=Number(row.querySelector('[data-field="quantity"]').value),start=row.querySelector('[data-field="rental_date"]').value,end=row.querySelector('[data-field="due_date"]').value;
      const days=(new Date(end+'T00:00:00Z')-new Date(start+'T00:00:00Z'))/86400000+1;
      row.querySelector('.rental-suggestion').textContent=selected&&days>0?`ยอดแนะนำ ${(rate*qty*days).toFixed(2)} บาท`:'';
    });
    container.append(fragment);
  });
  // Keep Express qs arrays compact even after a middle row is removed.
  function reindex() {container.querySelectorAll('.rental-item').forEach((row,i)=>row.querySelectorAll('[data-field]').forEach(input=>{input.name=`items[${i}][${input.dataset.field}]`;input.id=`item-${i}-${input.dataset.field}`;input.parentElement.querySelector('label').htmlFor=input.id;}));index=container.children.length;}
  form.addEventListener('input',()=>{
    const seconds=value=>{const p=value.split(':').map(Number);return p[0]*3600+p[1]*60+(p[2]||0);};
    const start=seconds(document.getElementById('start_time').value),end=seconds(document.getElementById('end_time').value),rate=Number(document.getElementById('court_id').selectedOptions[0]?.dataset.rate||0);
    document.getElementById('suggested-booking').textContent=end>start?`ยอดแนะนำ ${((end-start)/3600*rate).toFixed(2)} บาท`:'';
  });
  form.addEventListener('submit',event=>{
    reindex();
    const ids=Array.from(container.querySelectorAll('[data-field="equipment_id"]')).map(el=>el.value).filter(Boolean);
    if(new Set(ids).size!==ids.length){event.preventDefault();window.alert('อุปกรณ์ประเภทเดียวกันให้รวมจำนวนเป็นหนึ่งรายการ');}
  });
}

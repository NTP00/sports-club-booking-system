'use strict';
const express=require('express');
const controllers=require('../controllers/club');
module.exports=service=>{
  const router=express.Router(),c=controllers(service);
  router.get('/',c.dashboard);
  router.get('/reports',c.reports);
  router.get('/court_bookings/new',c.bookingForm);
  router.post('/court_bookings/new',c.book);
  router.post('/equipment_rentals/:id/return',c.returnRental);
  router.get('/:resource',c.list);
  router.get('/:resource/new',c.form);
  router.post('/:resource/new',c.save);
  router.get('/:resource/:id/edit',c.form);
  router.post('/:resource/:id/edit',c.save);
  router.post('/:resource/:id/status',c.status);
  router.get('/:resource/:id',c.detail);
  return router;
};

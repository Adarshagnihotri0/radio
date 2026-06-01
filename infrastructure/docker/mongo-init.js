db = db.getSiblingDB('radius');

db.createUser({
  user: 'radius_app',
  pwd: 'radius_app_pass',
  roles: [{ role: 'readWrite', db: 'radius' }],
});

db.createCollection('users');
db.createCollection('channels');
db.createCollection('voice_sessions');

// 2dsphere indexes (also created by Mongoose on startup, but idempotent)
db.users.createIndex({ location: '2dsphere' });
db.channels.createIndex({ center: '2dsphere' });

print('Radius DB initialized.');

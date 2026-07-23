// Server-side pilot used for computer opponents.  It works from world entities
// so it avoids both map blocks and the outer walls.
var THRUST = 1;
var SHOOT = 2;
var SHIELD = 4;
var SHIP_RADIUS = 24;
var LOOK_AHEAD = 1.4;

function directionForAngle(angle) { return [Math.sin(angle), -Math.cos(angle)]; }
function angleForDirection(dx, dy) { return Math.atan2(dx, -dy); }
function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function distanceToBox(origin, direction, box) {
  var minX = box.pos[0] - SHIP_RADIUS;
  var minY = box.pos[1] - SHIP_RADIUS;
  var maxX = box.pos[0] + box.size[0] + SHIP_RADIUS;
  var maxY = box.pos[1] + box.size[1] + SHIP_RADIUS;
  var tx1 = direction[0] ? (minX - origin[0]) / direction[0] : -Infinity;
  var tx2 = direction[0] ? (maxX - origin[0]) / direction[0] : Infinity;
  var ty1 = direction[1] ? (minY - origin[1]) / direction[1] : -Infinity;
  var ty2 = direction[1] ? (maxY - origin[1]) / direction[1] : Infinity;
  var enter = Math.max(Math.min(tx1, tx2), Math.min(ty1, ty2));
  var exit = Math.min(Math.max(tx1, tx2), Math.max(ty1, ty2));
  return exit >= Math.max(enter, 0) ? Math.max(enter, 0) : Infinity;
}

function obstacleDistance(world, origin, direction) {
  var nearest = Infinity;
  for (var id in world.entities) {
    var entity = world.entities[id];
    if (entity.type !== 'wall' && entity.type !== 'block') continue;
    nearest = Math.min(nearest, distanceToBox(origin, direction, entity));
  }
  return nearest;
}

function chooseTarget(world, player) {
  var target = null;
  var bestDistance = Infinity;
  for (var id in world.players) {
    var candidate = world.players[id];
    if (candidate === player || candidate.dead || !candidate.entity) continue;
    var dx = candidate.entity.pos[0] - player.entity.pos[0];
    var dy = candidate.entity.pos[1] - player.entity.pos[1];
    var distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < bestDistance) { target = candidate; bestDistance = distance; }
  }
  return target;
}

function updateBot(world, player) {
  if (player.dead || !player.entity) return;
  var ship = player.entity;
  var target = chooseTarget(world, player);
  var desired = ship.angle;
  var targetDistance = Infinity;
  var clearShot = false;
  if (target) {
    var dx = target.entity.pos[0] - ship.pos[0];
    var dy = target.entity.pos[1] - ship.pos[1];
    targetDistance = Math.sqrt(dx * dx + dy * dy);
    desired = angleForDirection(dx, dy);
    clearShot = obstacleDistance(world, ship.pos, [dx / targetDistance, dy / targetDistance]) > targetDistance;
  }

  var bestAngle = desired;
  var bestScore = -Infinity;
  for (var offset = -Math.PI; offset <= Math.PI; offset += Math.PI / 12) {
    var angle = desired + offset;
    var distance = obstacleDistance(world, ship.pos, directionForAngle(angle));
    var score = Math.min(distance, 500) + Math.cos(offset) * 180;
    if (score > bestScore) { bestScore = score; bestAngle = angle; }
  }

  var speed = Math.sqrt(ship.vel[0] * ship.vel[0] + ship.vel[1] * ship.vel[1]);
  var velocityDirection = speed ? [ship.vel[0] / speed, ship.vel[1] / speed] : directionForAngle(bestAngle);
  var stoppingDistance = obstacleDistance(world, ship.pos, velocityDirection);
  var emergency = stoppingDistance < Math.max(70, speed * LOOK_AHEAD);
  var turn = normalizeAngle(bestAngle - ship.angle);
  var maxTurn = 3.5 * (world.delta || 0.017);
  ship.angle = normalizeAngle(ship.angle + Math.max(-maxTurn, Math.min(maxTurn, turn)));

  var action = 0;
  if (!emergency && Math.abs(turn) < 0.65 && speed < 85) action |= THRUST;
  if (emergency) action |= SHIELD;
  if (target && clearShot && targetDistance < 700 && Math.abs(normalizeAngle(desired - ship.angle)) < 0.10) action |= SHOOT;
  player.action = action;
}

exports.updateBots = function(world) {
  for (var id in world.players) if (world.players[id].bot) updateBot(world, world.players[id]);
};

const RoomMember = require('../models/RoomMember');

async function getMember(userId, roomId) {
  return await RoomMember.findOne({ userId, roomId, status: 'ACTIVE' });
}

exports.canManagePlayback = async (req, res, next) => {
  try {
    const member = await getMember(req.user._id, req.params.roomId);
    if (!member) return res.status(403).json({ error: 'Not a member of this room' });
    if (member.role !== 'ADMIN' && member.role !== 'CONTROLLER') {
      return res.status(403).json({ error: 'Permission denied: Playback control requires ADMIN or CONTROLLER role' });
    }
    req.roomMember = member;
    next();
  } catch (e) {
    res.status(500).json({ error: 'Permission check failed' });
  }
};

exports.canManageQueue = async (req, res, next) => {
  try {
    const member = await getMember(req.user._id, req.params.roomId);
    if (!member) return res.status(403).json({ error: 'Not a member of this room' });
    if (member.role !== 'ADMIN' && member.role !== 'CONTROLLER') {
      return res.status(403).json({ error: 'Permission denied: Queue control requires ADMIN or CONTROLLER role' });
    }
    req.roomMember = member;
    next();
  } catch (e) {
    res.status(500).json({ error: 'Permission check failed' });
  }
};

exports.canManageMembers = async (req, res, next) => {
  try {
    const member = await getMember(req.user._id, req.params.roomId);
    if (!member) return res.status(403).json({ error: 'Not a member of this room' });
    if (member.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Permission denied: Member management requires ADMIN role' });
    }
    req.roomMember = member;
    next();
  } catch (e) {
    res.status(500).json({ error: 'Permission check failed' });
  }
};

exports.isMember = async (req, res, next) => {
  try {
    const member = await getMember(req.user._id, req.params.roomId);
    if (!member) return res.status(403).json({ error: 'Not a member of this room' });
    req.roomMember = member;
    next();
  } catch (e) {
    res.status(500).json({ error: 'Permission check failed' });
  }
};

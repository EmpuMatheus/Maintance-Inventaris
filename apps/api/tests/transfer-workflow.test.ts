import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import * as transferSvc from '@/modules/assets/transfer.service';

const sql = postgres(env.DATABASE_URL, { max: 1 });

let categoryId: string;
let subcategoryId: string;
let siteId: string;
let buildingId: string;
let floorId: string;
let fromRoomId: string;
let toRoomId: string;
let assetId: string;
let holderId: string;
let receiverId: string;
let witnessId: string;
let creatorId: string;
let transferId: string;

// Second asset + receiver used for receiver-context / assignment rotation tests.
let deptId: string;
let asset2Id: string;
let receiver2Id: string;
let receiver2DeptId: string;
let receiver2RoomId: string;

const createdUserIds: string[] = [];

async function makeUser(code: string, name: string): Promise<string> {
  const rows = await sql`
    INSERT INTO users (id, employee_code, name, username, is_active, must_change_password, created_at, updated_at)
    VALUES (gen_random_uuid(), ${code}, ${name}, ${code.toLowerCase()}, true, false, now(), now())
    RETURNING id`;
  createdUserIds.push(rows[0].id);
  return rows[0].id;
}

async function makeUserWithDept(code: string, name: string, departmentId: string | null): Promise<string> {
  const rows = await sql`
    INSERT INTO users (id, employee_code, name, username, department_id, is_active, must_change_password, created_at, updated_at)
    VALUES (gen_random_uuid(), ${code}, ${name}, ${code.toLowerCase()}, ${departmentId}, true, false, now(), now())
    RETURNING id`;
  createdUserIds.push(rows[0].id);
  return rows[0].id;
}

beforeAll(async () => {
  const cat = await sql`INSERT INTO asset_categories (id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 'TWF_CAT', 'Transfer WF Cat', true, now(), now()) RETURNING id`;
  categoryId = cat[0].id;
  const sub = await sql`INSERT INTO asset_subcategories (id, category_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${categoryId}, 'TWF_SUB', 'Transfer WF Sub', true, now(), now()) RETURNING id`;
  subcategoryId = sub[0].id;
  const site = await sql`INSERT INTO sites (id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 'TWF_SITE', 'Transfer WF Site', true, now(), now()) RETURNING id`;
  siteId = site[0].id;
  const bldg = await sql`INSERT INTO buildings (id, site_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${siteId}, 'TWF_B', 'Transfer WF Building', true, now(), now()) RETURNING id`;
  buildingId = bldg[0].id;
  const flr = await sql`INSERT INTO floors (id, building_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${buildingId}, 'TWF_F', 'Transfer WF Floor', true, now(), now()) RETURNING id`;
  floorId = flr[0].id;
  const room = await sql`INSERT INTO rooms (id, floor_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${floorId}, 'TWF_R', 'Transfer WF Room', true, now(), now()) RETURNING id`;
  toRoomId = room[0].id;
  const room2 = await sql`INSERT INTO rooms (id, floor_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${floorId}, 'TWF_R2', 'Transfer WF Room 2', true, now(), now()) RETURNING id`;
  fromRoomId = room2[0].id;

  holderId = await makeUser('TWF_HOLDER', 'Holder User');
  receiverId = await makeUser('TWF_RECEIVER', 'Receiver User');
  witnessId = await makeUser('TWF_WITNESS', 'Witness User');
  creatorId = await makeUser('TWF_CREATOR', 'Creator User');

  const asset = await sql`
    INSERT INTO assets (id, asset_code, asset_name, category_id, subcategory_id, site_id, building_id, floor_id, room_id, status, condition, created_at, updated_at)
    VALUES (gen_random_uuid(), 'TWF-AST-0001', 'Transfer WF Laptop', ${categoryId}, ${subcategoryId}, ${siteId}, ${buildingId}, ${floorId}, ${fromRoomId}, 'ASSIGNED', 'GOOD', now(), now())
    RETURNING id`;
  assetId = asset[0].id;

  await sql`
    INSERT INTO asset_assignments (id, asset_id, user_id, assigned_date, status, created_at, updated_at)
    VALUES (gen_random_uuid(), ${assetId}, ${holderId}, now()::date, 'ACTIVE', now(), now())`;

  // Receiver with its own department and an active asset in a distinct room.
  const dept = await sql`INSERT INTO departments (id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 'TWF_DEPT', 'Transfer WF Dept', true, now(), now()) RETURNING id`;
  deptId = dept[0].id;
  const room3 = await sql`INSERT INTO rooms (id, floor_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${floorId}, 'TWF_R3', 'Transfer WF Room 3', true, now(), now()) RETURNING id`;
  receiver2RoomId = room3[0].id;
  receiver2Id = await makeUserWithDept('TWF_RECEIVER2', 'Receiver Two', deptId);
  receiver2DeptId = deptId;
  const asset2 = await sql`
    INSERT INTO assets (id, asset_code, asset_name, category_id, subcategory_id, site_id, building_id, floor_id, room_id, department_id, status, condition, created_at, updated_at)
    VALUES (gen_random_uuid(), 'TWF-AST-0002', 'Receiver Two Laptop', ${categoryId}, ${subcategoryId}, ${siteId}, ${buildingId}, ${floorId}, ${receiver2RoomId}, ${deptId}, 'ASSIGNED', 'GOOD', now(), now())
    RETURNING id`;
  asset2Id = asset2[0].id;
  await sql`
    INSERT INTO asset_assignments (id, asset_id, user_id, department_id, assigned_date, status, created_at, updated_at)
    VALUES (gen_random_uuid(), ${asset2Id}, ${receiver2Id}, ${deptId}, now()::date, 'ACTIVE', now(), now())`;
});

afterAll(async () => {
  if (transferId) {
    await sql`DELETE FROM asset_movements WHERE transfer_id = ${transferId}`;
    await sql`DELETE FROM transfer_confirmations WHERE transfer_id = ${transferId}`;
    await sql`DELETE FROM asset_transfers WHERE id = ${transferId}`;
  }
  await sql`DELETE FROM transfer_confirmations WHERE user_id = ANY(${createdUserIds}::uuid[])`;
  await sql`DELETE FROM asset_movements WHERE asset_id = ${assetId}`;
  await sql`DELETE FROM asset_transfers WHERE asset_id = ${assetId}`;
  await sql`DELETE FROM asset_assignments WHERE asset_id = ${assetId}`;
  await sql`DELETE FROM assets WHERE id = ${assetId}`;
  if (asset2Id) {
    await sql`DELETE FROM asset_movements WHERE asset_id = ${asset2Id}`;
    await sql`DELETE FROM asset_transfers WHERE asset_id = ${asset2Id}`;
    await sql`DELETE FROM asset_assignments WHERE asset_id = ${asset2Id}`;
    await sql`DELETE FROM assets WHERE id = ${asset2Id}`;
  }
  await sql`DELETE FROM rooms WHERE id = ${toRoomId}`;
  await sql`DELETE FROM rooms WHERE id = ${fromRoomId}`;
  if (receiver2RoomId) await sql`DELETE FROM rooms WHERE id = ${receiver2RoomId}`;
  await sql`DELETE FROM floors WHERE id = ${floorId}`;
  await sql`DELETE FROM buildings WHERE id = ${buildingId}`;
  await sql`DELETE FROM sites WHERE id = ${siteId}`;
  await sql`DELETE FROM asset_subcategories WHERE id = ${subcategoryId}`;
  await sql`DELETE FROM asset_categories WHERE id = ${categoryId}`;
  for (const uid of createdUserIds) {
    await sql`DELETE FROM notifications WHERE user_id = ${uid}`;
    await sql`DELETE FROM users WHERE id = ${uid}`;
  }
  if (deptId) await sql`DELETE FROM departments WHERE id = ${deptId}`;
  await sql.end();
});

describe('Transfer Location workflow', () => {
  it('creates a transfer with 4 merged parties (one confirmation per unique user)', async () => {
    const res = await transferSvc.createTransfer(
      assetId,
      { siteId, buildingId, floorId, roomId: toRoomId, receiverUserId: receiverId, witnessUserIds: [witnessId], reason: 'QA move' },
      undefined,
      creatorId,
    );
    transferId = res.id as string;
    const detail = (await transferSvc.getTransferById(transferId)) as any;
    expect(detail.status).toBe('PENDING');
    const byUser = new Map<string, any>();
    for (const c of detail.confirmations) byUser.set(c.userId, c);
    expect(byUser.size).toBe(4);
    expect(byUser.get(holderId).roles).toContain('PREVIOUS_HOLDER');
    expect(byUser.get(receiverId).roles).toContain('NEXT_RECEIVER');
    expect(byUser.get(witnessId).roles).toContain('KNOWER');
    expect(byUser.get(creatorId).roles).toContain('CREATOR');
    expect(detail.confirmations.every((c: any) => c.status === 'PENDING')).toBe(true);
  });

  it('merges roles when creator is also previous holder (single row)', async () => {
    // Make the creator the active holder by reassigning.
    await sql`UPDATE asset_assignments SET status = 'RETURNED' WHERE asset_id = ${assetId} AND status = 'ACTIVE'`;
    await sql`INSERT INTO asset_assignments (id, asset_id, user_id, assigned_date, status, created_at, updated_at) VALUES (gen_random_uuid(), ${assetId}, ${creatorId}, now()::date, 'ACTIVE', now(), now())`;

    // Cancel first transfer so a new pending one can be created.
    await transferSvc.cancelTransfer(transferId);

    const res = await transferSvc.createTransfer(
      assetId,
      { siteId, buildingId, floorId, roomId: toRoomId, receiverUserId: receiverId, witnessUserIds: [], reason: 'QA move 2' },
      undefined,
      creatorId,
    );
    const secondId = res.id as string;
    const detail = (await transferSvc.getTransferById(secondId)) as any;
    const creatorRow = detail.confirmations.find((c: any) => c.userId === creatorId);
    expect(creatorRow.roles).toContain('CREATOR');
    expect(creatorRow.roles).toContain('PREVIOUS_HOLDER');
    // holderId is no longer active, so not a party
    expect(detail.confirmations.find((c: any) => c.userId === holderId)).toBeUndefined();

    // Confirm both parties -> COMPLETED + exactly one movement + asset moved.
    const r1 = await transferSvc.confirmTransfer(secondId, creatorId);
    expect((r1 as any).completed).toBe(false);
    const noMovement = await sql`SELECT count(*)::int AS c FROM asset_movements WHERE transfer_id = ${secondId}`;
    expect(Number(noMovement[0].c)).toBe(0);

    const r2 = await transferSvc.confirmTransfer(secondId, receiverId);
    expect((r2 as any).completed).toBe(true);
    const movement = await sql`SELECT count(*)::int AS c FROM asset_movements WHERE transfer_id = ${secondId}`;
    expect(Number(movement[0].c)).toBe(1);

    const detailAfter = (await transferSvc.getTransferById(secondId)) as any;
    expect(detailAfter.status).toBe('COMPLETED');
    expect(detailAfter.confirmations.every((c: any) => c.status === 'CONFIRMED')).toBe(true);

    // cleanup second transfer
    await sql`DELETE FROM asset_movements WHERE transfer_id = ${secondId}`;
    await sql`DELETE FROM transfer_confirmations WHERE transfer_id = ${secondId}`;
    await sql`DELETE FROM asset_transfers WHERE id = ${secondId}`;
  });

  it('rejects transfer with a required reason, stops immediately and creates no movement', async () => {
    // Fresh assignment back to holder for a clean transfer.
    await sql`UPDATE assets SET room_id = ${fromRoomId} WHERE id = ${assetId}`;
    await sql`UPDATE asset_assignments SET status = 'RETURNED' WHERE asset_id = ${assetId} AND status = 'ACTIVE'`;
    await sql`INSERT INTO asset_assignments (id, asset_id, user_id, assigned_date, status, created_at, updated_at) VALUES (gen_random_uuid(), ${assetId}, ${holderId}, now()::date, 'ACTIVE', now(), now())`;

    const res = await transferSvc.createTransfer(
      assetId,
      { siteId, buildingId, floorId, roomId: toRoomId, receiverUserId: receiverId, witnessUserIds: [witnessId], reason: 'QA reject' },
      undefined,
      creatorId,
    );
    const tid = res.id as string;

    await expect(transferSvc.rejectTransfer(tid, receiverId, '')).rejects.toThrow(/reason/i);

    await transferSvc.rejectTransfer(tid, receiverId, 'Barang tidak sesuai');
    const detail = (await transferSvc.getTransferById(tid)) as any;
    expect(detail.status).toBe('REJECTED');
    expect(detail.rejectionReason).toBe('Barang tidak sesuai');
    expect(detail.rejectedByName).toBe('Receiver User');
    const rejected = detail.confirmations.find((c: any) => c.userId === receiverId);
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.reason).toBe('Barang tidak sesuai');

    // No movements for a rejected transfer.
    const movement = await sql`SELECT count(*)::int AS c FROM asset_movements WHERE transfer_id = ${tid}`;
    expect(Number(movement[0].c)).toBe(0);

    // Asset did not move.
    const asset = await sql`SELECT room_id FROM assets WHERE id = ${assetId}`;
    expect(asset[0].room_id).toBe(fromRoomId);

    await sql`DELETE FROM transfer_confirmations WHERE transfer_id = ${tid}`;
    await sql`DELETE FROM asset_transfers WHERE id = ${tid}`;
  });

  it('prevents duplicate confirmation for the same user', async () => {
    await sql`UPDATE assets SET room_id = ${fromRoomId} WHERE id = ${assetId}`;
    await sql`UPDATE asset_assignments SET status = 'RETURNED' WHERE asset_id = ${assetId} AND status = 'ACTIVE'`;
    await sql`INSERT INTO asset_assignments (id, asset_id, user_id, assigned_date, status, created_at, updated_at) VALUES (gen_random_uuid(), ${assetId}, ${holderId}, now()::date, 'ACTIVE', now(), now())`;

    const res = await transferSvc.createTransfer(
      assetId,
      { siteId, buildingId, floorId, roomId: toRoomId, receiverUserId: receiverId, witnessUserIds: [], reason: 'QA dup' },
      undefined,
      creatorId,
    );
    const tid = res.id as string;
    await transferSvc.confirmTransfer(tid, receiverId);
    await expect(transferSvc.confirmTransfer(tid, receiverId)).rejects.toThrow(/already/i);

    await sql`DELETE FROM transfer_confirmations WHERE transfer_id = ${tid}`;
    await sql`DELETE FROM asset_transfers WHERE id = ${tid}`;
  });

  it('rejects transfer creation when the asset has no active assignment', async () => {
    // Temporarily remove the active assignment for the primary asset.
    await sql`UPDATE asset_assignments SET status = 'RETURNED' WHERE asset_id = ${assetId} AND status = 'ACTIVE'`;
    await expect(
      transferSvc.createTransfer(
        assetId,
        { siteId, buildingId, floorId, roomId: toRoomId, receiverUserId: receiverId, witnessUserIds: [], reason: 'no assignment' },
        undefined,
        creatorId,
      ),
    ).rejects.toThrow(/active assignment/i);

    // Restore for subsequent tests.
    await sql`INSERT INTO asset_assignments (id, asset_id, user_id, assigned_date, status, created_at, updated_at) VALUES (gen_random_uuid(), ${assetId}, ${holderId}, now()::date, 'ACTIVE', now(), now())`;
  });

  it('resolves receiver department and location from the receiver active assignment', async () => {
    const ctx = await transferSvc.getReceiverContext(receiver2Id);
    expect(ctx.departmentId).toBe(receiver2DeptId);
    expect(ctx.location?.roomId).toBe(receiver2RoomId);
  });

  it('ignores client supply of target location/department when receiver has an active assignment', async () => {
    await sql`UPDATE assets SET room_id = ${fromRoomId} WHERE id = ${assetId}`;
    await sql`UPDATE asset_assignments SET status = 'RETURNED' WHERE asset_id = ${assetId} AND status = 'ACTIVE'`;
    await sql`INSERT INTO asset_assignments (id, asset_id, user_id, assigned_date, status, created_at, updated_at) VALUES (gen_random_uuid(), ${assetId}, ${holderId}, now()::date, 'ACTIVE', now(), now())`;

    // Send a bogus room/department; backend must follow receiver2's assignment.
    const res = await transferSvc.createTransfer(
      assetId,
      { siteId, buildingId, floorId, roomId: toRoomId, departmentId: null, receiverUserId: receiver2Id, witnessUserIds: [], reason: 'auto follow' },
      undefined,
      creatorId,
    );
    const tid = res.id as string;
    const detail = (await transferSvc.getTransferById(tid)) as any;
    expect(detail.toRoomName).toBe('Transfer WF Room 3');
    const row = await sql`SELECT to_room_id, to_department_id FROM asset_transfers WHERE id = ${tid}`;
    expect(row[0].to_room_id).toBe(receiver2RoomId);
    expect(row[0].to_department_id).toBe(receiver2DeptId);

    await sql`DELETE FROM transfer_confirmations WHERE transfer_id = ${tid}`;
    await sql`DELETE FROM asset_transfers WHERE id = ${tid}`;
  });

  it('exposes the confirmation parties on the active (pending) transfer', async () => {
    await sql`UPDATE assets SET room_id = ${fromRoomId} WHERE id = ${assetId}`;
    await sql`UPDATE asset_assignments SET status = 'RETURNED' WHERE asset_id = ${assetId} AND status = 'ACTIVE'`;
    await sql`INSERT INTO asset_assignments (id, asset_id, user_id, assigned_date, status, created_at, updated_at) VALUES (gen_random_uuid(), ${assetId}, ${holderId}, now()::date, 'ACTIVE', now(), now())`;

    const res = await transferSvc.createTransfer(
      assetId,
      { siteId, buildingId, floorId, roomId: toRoomId, receiverUserId: receiverId, witnessUserIds: [witnessId], reason: 'active confirmations' },
      undefined,
      creatorId,
    );
    const tid = res.id as string;

    const active = (await transferSvc.getActiveTransfer(assetId)) as any;
    expect(active?.id).toBe(tid);
    expect(Array.isArray(active?.confirmations)).toBe(true);
    expect(active.confirmations.length).toBe(4);
    expect(active.confirmations.every((c: any) => c.status === 'PENDING')).toBe(true);

    await sql`DELETE FROM transfer_confirmations WHERE transfer_id = ${tid}`;
    await sql`DELETE FROM asset_transfers WHERE id = ${tid}`;
  });

  it('closes the old assignment and opens a new one for the receiver on completion', async () => {
    await sql`UPDATE assets SET room_id = ${fromRoomId} WHERE id = ${assetId}`;
    await sql`UPDATE asset_assignments SET status = 'RETURNED' WHERE asset_id = ${assetId} AND status = 'ACTIVE'`;
    await sql`INSERT INTO asset_assignments (id, asset_id, user_id, assigned_date, status, created_at, updated_at) VALUES (gen_random_uuid(), ${assetId}, ${holderId}, now()::date, 'ACTIVE', now(), now())`;

    const res = await transferSvc.createTransfer(
      assetId,
      { siteId, buildingId, floorId, roomId: receiver2RoomId, receiverUserId: receiverId, witnessUserIds: [], reason: 'complete rotate' },
      undefined,
      creatorId,
    );
    const tid = res.id as string;
    // Parties: holder, receiver (creator is not necessarily a party here). Confirm all.
    const detail = (await transferSvc.getTransferById(tid)) as any;
    for (const c of detail.confirmations) {
      await transferSvc.confirmTransfer(tid, c.userId);
    }
    const after = await sql`SELECT status FROM asset_transfers WHERE id = ${tid}`;
    expect(after[0].status).toBe('COMPLETED');

    const active = await sql`SELECT user_id, status FROM asset_assignments WHERE asset_id = ${assetId} AND status = 'ACTIVE'`;
    expect(active.length).toBe(1);
    expect(active[0].user_id).toBe(receiverId);
    const returnedOld = await sql`SELECT count(*)::int AS c FROM asset_assignments WHERE asset_id = ${assetId} AND user_id = ${holderId} AND status = 'RETURNED'`;
    expect(Number(returnedOld[0].c)).toBeGreaterThanOrEqual(1);
    const movements = await sql`SELECT count(*)::int AS c FROM asset_movements WHERE transfer_id = ${tid}`;
    expect(Number(movements[0].c)).toBe(1);

    await sql`DELETE FROM asset_movements WHERE transfer_id = ${tid}`;
    await sql`DELETE FROM transfer_confirmations WHERE transfer_id = ${tid}`;
    await sql`DELETE FROM asset_transfers WHERE id = ${tid}`;
  });
});

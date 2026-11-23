const Device = require('../src/models/Device');
const DeviceEvent = require('../src/models/DeviceEvent');
const Alert = require('../src/models/Alert');
const sockets = require('../src/sockets');
const riskEngine = require('../src/services/riskEngine');
const { recomputeAllDevicesRisk } = require('../src/services/riskDecayService');
const { createDevice, createEvent, createAlert } = require('./helpers');

describe('Risk Decay Service', () => {
  afterEach(() => {
    sockets.setIO(null);
    jest.restoreAllMocks();
  });

  it('resets a device with high stored score and no events in last 24h to 0 and moves from suspicious to normal', async () => {
    const device = await createDevice({
      status: 'suspicious',
      riskScore: 85,
      firstSeen: new Date(Date.now() - 48 * 60 * 60 * 1000)
    });

    await recomputeAllDevicesRisk();

    const updated = await Device.findById(device._id);
    expect(updated.riskScore).toBe(0);
    expect(updated.status).toBe('normal');
  });

  it('preserves score for a device with recent risky events', async () => {
    const device = await createDevice({ status: 'normal', riskScore: 30 });
    // Event from 10 minutes ago
    await createEvent(device._id, {
      eventType: 'port_scan',
      timestamp: new Date(Date.now() - 10 * 60 * 1000)
    });

    await recomputeAllDevicesRisk();

    const updated = await Device.findById(device._id);
    expect(updated.riskScore).toBe(30);
  });

  it('assigns a lower score to a device whose events are partly aged, matching the weighting', async () => {
    const device = await createDevice({ status: 'normal', riskScore: 30 });
    // Event from 12.5 hours ago (~50% weight)
    const twelveAndHalfHoursAgo = new Date(Date.now() - 12.5 * 60 * 60 * 1000);
    await createEvent(device._id, {
      eventType: 'port_scan',
      timestamp: twelveAndHalfHoursAgo
    });

    await recomputeAllDevicesRisk();

    const updated = await Device.findById(device._id);
    // Port scan is 30 points * 0.5 = 15 points
    expect(updated.riskScore).toBe(15);
    expect(updated.riskScore).toBeLessThan(30);
  });

  it('never creates, modifies or resolves alerts during decay', async () => {
    const device = await createDevice({ status: 'suspicious', riskScore: 80 });
    const alert = await createAlert(device._id, {
      status: 'open',
      severity: 'high',
      reason: 'Critical threat'
    });

    const alertCountBefore = await Alert.countDocuments();
    await recomputeAllDevicesRisk();
    const alertCountAfter = await Alert.countDocuments();

    expect(alertCountAfter).toBe(alertCountBefore);

    const alertAfter = await Alert.findById(alert._id);
    expect(alertAfter.status).toBe('open');
    expect(alertAfter.severity).toBe('high');
    expect(alertAfter.reason).toBe('Critical threat');
  });

  it('emits device:updated only for devices whose score or status changed', async () => {
    // Device 1: will change (stored 70 -> 0)
    const device1 = await createDevice({
      status: 'suspicious',
      riskScore: 70,
      firstSeen: new Date(Date.now() - 30 * 60 * 60 * 1000)
    });

    // Device 2: already 0 and normal, no events -> will NOT change
    const device2 = await createDevice({
      status: 'normal',
      riskScore: 0,
      firstSeen: new Date(Date.now() - 30 * 60 * 60 * 1000)
    });

    const mockEmit = jest.fn();
    sockets.setIO({
      emit: mockEmit,
      to: () => ({ emit: mockEmit }),
      in: () => ({ emit: mockEmit })
    });

    await recomputeAllDevicesRisk();

    const deviceUpdatedCalls = mockEmit.mock.calls.filter((call) => call[0] === 'device:updated');
    const emittedDeviceIds = deviceUpdatedCalls.map((call) => call[1]._id.toString());

    expect(emittedDeviceIds).toContain(device1._id.toString());
    expect(emittedDeviceIds).not.toContain(device2._id.toString());
  });

  it('does not crash when there are no devices in the database', async () => {
    await Device.deleteMany({});
    await expect(recomputeAllDevicesRisk()).resolves.not.toThrow();
  });

  it('prevents two overlapping runs from executing concurrently (concurrency guard)', async () => {
    const device = await createDevice({ riskScore: 50 });

    let resolveCalculation;
    const calcWait = new Promise((resolve) => {
      resolveCalculation = resolve;
    });

    let calls = 0;
    jest.spyOn(riskEngine, 'calculateRiskScore').mockImplementation(async () => {
      calls++;
      await calcWait;
      return { score: 10, triggeredRules: [] };
    });

    // Start first run (will pause in calculateRiskScore)
    const run1 = recomputeAllDevicesRisk();

    // Start second run immediately while first run is in progress
    const run2 = recomputeAllDevicesRisk();

    // Release the calculation
    resolveCalculation();
    await Promise.all([run1, run2]);

    // calculateRiskScore should only have been called for run1 (1 device = 1 call)
    expect(calls).toBe(1);
  });
});

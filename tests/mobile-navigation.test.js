import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackStack, swipeStep, MOBILE_TABS } from '../shared/mobile-navigation.js';

test('deliberate horizontal gestures navigate but scroll, taps and long drags do not', () => {
  assert.equal(swipeStep(-100, 12, 250), 1);
  assert.equal(swipeStep(100, -12, 250), -1);
  for (const gesture of [[30, 2, 100], [90, 80, 200], [120, 5, 900], [0, 200, 100]]) {
    assert.equal(swipeStep(...gesture), 0);
  }
  assert.equal(MOBILE_TABS[0], 'discover');
  assert.equal(MOBILE_TABS.at(-1), 'profile');
});
test('Back closes only the top layer, preserves its parent and cleans up unmounted layers', () => {
  const stack = createBackStack();
  const calls = [];
  const removeParent = stack.add(() => calls.push('parent'));
  const removeChild = stack.add(() => calls.push('child'));
  assert.equal(stack.closeTop(), true);
  assert.deepEqual(calls, ['child']);
  removeChild(); removeChild();
  stack.closeTop();
  assert.deepEqual(calls, ['child', 'parent']);
  removeParent();
  assert.equal(stack.closeTop(), false);
  assert.equal(stack.hasLayers(), false);
});
test('busy modal consumes Back without falling through to navigation', () => {
  const stack = createBackStack();
  const cleanup = stack.add(() => {});
  assert.equal(stack.closeTop(), true);
  assert.equal(stack.hasLayers(), true);
  cleanup();
});

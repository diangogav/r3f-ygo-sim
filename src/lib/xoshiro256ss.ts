function rol64(x: bigint, k: bigint) {
  return (x << k) | (x >> (64n - k));
}

export function xoshiro256ss(state: [bigint, bigint, bigint, bigint]) {
  return function () {
    const result = rol64(state[1] * 5n, 7n) * 9n;
    const t = state[1] << 17n;
    state[2] ^= state[0];
    state[3] ^= state[1];
    state[1] ^= state[2];
    state[0] ^= state[3];
    state[2] ^= t;
    state[3] = rol64(state[3], 45n);
    return Number(BigInt.asUintN(53, result)) / (Number.MAX_SAFE_INTEGER + 1);
  };
}

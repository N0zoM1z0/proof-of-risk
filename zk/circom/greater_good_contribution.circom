pragma circom 2.2.3;

template Range0To5() {
  signal input value;
  signal p1;
  signal p2;
  signal p3;
  signal p4;
  signal p5;

  p1 <== value * (value - 1);
  p2 <== p1 * (value - 2);
  p3 <== p2 * (value - 3);
  p4 <== p3 * (value - 4);
  p5 <== p4 * (value - 5);
  p5 === 0;
}

template Range0To4() {
  signal input value;
  signal p1;
  signal p2;
  signal p3;
  signal p4;

  p1 <== value * (value - 1);
  p2 <== p1 * (value - 2);
  p3 <== p2 * (value - 3);
  p4 <== p3 * (value - 4);
  p4 === 0;
}

template GreaterGoodContribution() {
  signal input tax;
  signal input personal;
  signal input salt;
  signal input coinsPerRound;
  signal input sumTax;
  signal input alivePlayerCount;
  signal input publicReturn;
  signal input returnRemainder;
  signal input commitment;
  signal expectedCommitment;

  component taxRange = Range0To5();
  component personalRange = Range0To5();
  component remainderRange = Range0To4();

  taxRange.value <== tax;
  personalRange.value <== personal;
  remainderRange.value <== returnRemainder;

  coinsPerRound === 5;
  alivePlayerCount === 5;
  tax + personal === coinsPerRound;
  publicReturn * alivePlayerCount === sumTax * 2 + returnRemainder;

  // POC-only field arithmetic commitment. Production should replace this with a field-friendly hash.
  expectedCommitment <== tax + personal * 10 + salt * 100;
  commitment === expectedCommitment;
}

component main { public [coinsPerRound, sumTax, alivePlayerCount, publicReturn, returnRemainder, commitment] } = GreaterGoodContribution();

export interface BankPedalboard {
  title: string;
  bundle: string;
}

export interface Bank {
  title: string;
  pedalboards: BankPedalboard[];
}

export interface BankList {
  user: Bank[];
  factory: Bank[];
}

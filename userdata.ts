export { UserData };

import * as fs from 'fs';

class UserData<T> {
  readonly userData: { [key: string]: T } = {}
  readonly filePath: string
  readonly defaultValue: T

  constructor(defaultValue: T, filePath: string) {
    this.filePath = filePath;
    this.defaultValue = defaultValue;
    if (fs.existsSync(filePath)) {
      const parsedData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      for (const key in parsedData) {
        const data: any = parsedData[key];
        const filledData = { ...this.defaultValue, ...data };
        this.userData[key] = filledData;
      }
    }
  }

  // Function to get user data
  get(userId: string): T {
    if (userId in this.userData) {
      return this.userData[userId];
    }
    return this.update(userId, (inPlaceValue, hadKey) => {});
  }

  // Function to update user data
  update(userId: string, updater: (inPlaceValue: T, hadKey: boolean) => void): T {
    let hadKey = true;
    if (!(userId in this.userData)) {
      this.userData[userId] = { ...this.defaultValue };
      hadKey = false;
    }
    const saved = this.userData[userId];
    updater(saved, hadKey);
    this.saveUserData();
    return saved;
  }

  // Function to save user data to file
  saveUserData() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.userData), 'utf8');
  }
}

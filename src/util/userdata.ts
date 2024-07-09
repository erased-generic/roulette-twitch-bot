export { UserDatum, UserData, FileUserData, MemoryUserData };

import * as fs from 'fs';

interface UserDatum {
  username?: string;
}

abstract class UserData<T extends UserDatum> {
  readonly userData: { [key: string]: T } = {};
  readonly onReadValue: (userId: string, read: any) => T;
  readonly botUsername: string;

  constructor(onReadValue: (userId: string, read: any) => T, readUserData: () => any, botUsername: string) {
    this.onReadValue = (userId: string, read: any) => {
      const transformed: UserDatum = {
        username: (userId === botUsername ? botUsername : undefined),
        ...read
      };
      return onReadValue(userId, transformed);
    };
    this.botUsername = botUsername;
    const parsedData = readUserData();
    for (const key in parsedData) {
      const filledData = onReadValue(key, parsedData[key]);
      this.userData[key] = filledData;
    }
  }

  get(userId: string): T {
    if (userId in this.userData) {
      return this.userData[userId];
    }
    return this.update(userId, (inPlaceValue, hadKey) => {});
  }

  update(userId: string, updater: (inPlaceValue: T, hadKey: boolean) => void): T {
    let hadKey = true;
    if (!(userId in this.userData)) {
      this.userData[userId] = this.onReadValue(userId, {});
      hadKey = false;
    }
    const saved = this.userData[userId];
    updater(saved, hadKey);
    this.writeUserData();
    return saved;
  }

  getAll(): { [key: string]: T } {
    return this.userData;
  }

  abstract writeUserData(): void;
}

class FileUserData<T> extends UserData<T> {
  readonly filePath: string;

  constructor(onReadValue: (userId: string, read: any) => T, botUsername: string, filePath: string) {
    super(onReadValue, () => {
      try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (e) {
        if (e.code === 'ENOENT') {
          return {};
        }
        throw e;
      }
    }, botUsername);
    this.filePath = filePath;
  }

  writeUserData() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.userData), 'utf8');
  }
}

class MemoryUserData<T> extends UserData<T> {
  constructor(onReadValue: (userId: string, read: any) => T, botUsername: string, init: any) {
    super(onReadValue, () => init, botUsername);
  }

  writeUserData() {}
}

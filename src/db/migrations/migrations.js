// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_tense_harry_osborn.sql';
import m0001 from './0001_blue_hobgoblin.sql';
import m0002 from './0002_overrated_the_fallen.sql';
import m0003 from './0003_useful_meteorite.sql';
import m0004 from './0004_narrow_rogue.sql';
import m0005 from './0005_colorful_ben_urich.sql';
import m0006 from './0006_giant_unicorn.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005,
m0006
    }
  }
  
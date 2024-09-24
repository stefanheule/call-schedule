import { parseAmionEmail, ApplyAmionChangeRequest } from './parse-amion-email';
import { CallSchedule } from './shared/types';
import { loadStorage } from './storage';

// spell-checker:disable

function readData(): CallSchedule {
  const storage = loadStorage({
    noCheck: true,
  });
  return storage.versions[storage.versions.length - 1].callSchedule;
}

describe('test', () => {
  it('test', () => {
    const email: ApplyAmionChangeRequest = {
      auth: 'test',
      initialTry: true,
      email: {
        subject: 'FW: Pending trade between Connor Chestnut & Max Jentzsch',
        body:
          '\r\n' +
          '________________________________\r\n' +
          'From: Amion (no reply) <noreply@amion.com>\r\n' +
          'Sent: Monday, September 23, 2024 1:19:42 PM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
          'To: Chloe E Peters <cepeters@uw.edu>\r\n' +
          'Cc: Renee Kyle <drkyle@uw.edu>; Amy Say <amysay91@uw.edu>\r\n' +
          'Subject: Pending trade between Connor Chestnut & Max Jentzsch\r\n' +
          '\r\n' +
          'A trade awaits your approval:\r\n' +
          '\r\n' +
          "Max Jentzsch takes Connor Chestnut's HMC Night on Sun. Nov 3.\r\n" +
          "Connor Chestnut takes Max Jentzsch's HMC Night on Sun. Mar 2.\r\n" +
          '\r\n' +
          'Allow<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!165a1361h8mca58Q215R&Ui=24*211*Chestnut,*20Connor&Swjd=10169&Swsvc=4u159&Rsel=59&Ui=24*257*Jentzsch,*20Max&Swjd=10288&Swsvc=4u159&Swop=4&Syr=2024&From=!d65a1361t3qiitn3&Submit=Accept*switch__;KiolKiolKw!!K-Hz7m0Vt54!gsZIYd3fupSG8XjntuO4ZG1DX2tVWpy4poAgxvt5L4mN7m2EJAwONdghlUinxR6q3-Eer75tmFEgjw$>             Decline<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!165a1361h8mca58Q215R&Ui=24*211*Chestnut,*20Connor&Swjd=10169&Swsvc=4u159&Rsel=59&Ui=24*257*Jentzsch,*20Max&Swjd=10288&Swsvc=4u159&Swop=4&Syr=2024&From=!d65a1361t3qiitn3&Submit=Can*27t*do*it__;KiolKiolJSsr!!K-Hz7m0Vt54!gsZIYd3fupSG8XjntuO4ZG1DX2tVWpy4poAgxvt5L4mN7m2EJAwONdghlUinxR6q3-Eer74xYKabkg$>             Look before deciding<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!165a1361h8mca58Q215R&Ui=24*211*Chestnut,*20Connor&Swjd=10169&Swsvc=4u159&Rsel=59&Ui=24*257*Jentzsch,*20Max&Swjd=10288&Swsvc=4u159&Swop=4&Syr=2024&From=!d65a1361t3qiitn3&Submit=ViewTrd__;KiolKiol!!K-Hz7m0Vt54!gsZIYd3fupSG8XjntuO4ZG1DX2tVWpy4poAgxvt5L4mN7m2EJAwONdghlUinxR6q3-Eer75L0pG2qA$>\r\n' +
          '\r\n' +
          '\r\n' +
          '(pid: 2358987) jqs: File=%21165a135ehnew_31778&Syr=2024&Page=Swca&Rsel=%21165a135eh5mna55Q213R&Ui=24*211*Chestnut%2C+Connor&Month=11-24&Swjd=10169&Swsvc=4u159&Rsel=59&Ui=24*257*Jentzsch%2C+Max&Swjd=10288&Swsvc=4u159&Swop=4&Syr=2024&Swjd=10169&Swsvc=4u159&Rsel=59&Ui=24*257*Jentzsch%2C+Max&Swjd=10288&Swsvc=4u159&Swop=4&Syr=2024&Submit=Accept+switch&Enote=Note\r\n',
      },
    };

    const result = parseAmionEmail(email, readData());
    expect(result).toMatchInlineSnapshot(`
      {
        "changes": [
          {
            "kind": "regular",
            "next": "MJ",
            "previous": "CC",
            "shift": {
              "dayIndex": 0,
              "shiftName": "weekday_south",
              "weekIndex": 18,
            },
          },
          {
            "kind": "regular",
            "next": "CC",
            "previous": "MJ",
            "shift": {
              "dayIndex": 0,
              "shiftName": "weekday_south",
              "weekIndex": 35,
            },
          },
        ],
        "kind": "pending-changes",
      }
    `);
  });
});

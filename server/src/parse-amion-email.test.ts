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
    expect(parseAmionEmail(email, readData(), true)).toMatchInlineSnapshot(`
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
          'Sent: Monday, September 23, 2024 1:19:17 PM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
          'To: Chloe E Peters <cepeters@uw.edu>\r\n' +
          'Cc: Renee Kyle <drkyle@uw.edu>; Amy Say <amysay91@uw.edu>\r\n' +
          'Subject: Pending trade between Connor Chestnut & Max Jentzsch\r\n' +
          '\r\n' +
          'A trade awaits your approval:\r\n' +
          '\r\n' +
          "Max Jentzsch takes Connor Chestnut's VA Night on Sun. Nov 3.\r\n" +
          "Connor Chestnut takes Max Jentzsch's VA Night on Sun. Mar 2.\r\n" +
          '\r\n' +
          'Allow<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!165a1348h9moa59Q215R&Ui=24*211*Chestnut,*20Connor&Swjd=10169&Swsvc=12u189&Rsel=59&Ui=24*257*Jentzsch,*20Max&Swjd=10288&Swsvc=12u189&Swop=4&Syr=2024&From=!165a1348h-wcont-&Submit=Accept*switch__;KiolKiolKw!!K-Hz7m0Vt54!iOrOjgdCl0kQ_NSYaL4tzdDin0ZEU52h-jxQD6UngJZzo_XaNNd4Xaf0skN4QHNb5nqKQz5tpxt-Rw$>             Decline<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!165a1348h9moa59Q215R&Ui=24*211*Chestnut,*20Connor&Swjd=10169&Swsvc=12u189&Rsel=59&Ui=24*257*Jentzsch,*20Max&Swjd=10288&Swsvc=12u189&Swop=4&Syr=2024&From=!165a1348h-wcont-&Submit=Can*27t*do*it__;KiolKiolJSsr!!K-Hz7m0Vt54!iOrOjgdCl0kQ_NSYaL4tzdDin0ZEU52h-jxQD6UngJZzo_XaNNd4Xaf0skN4QHNb5nqKQz573SqS-w$>             Look before deciding<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!165a1348h9moa59Q215R&Ui=24*211*Chestnut,*20Connor&Swjd=10169&Swsvc=12u189&Rsel=59&Ui=24*257*Jentzsch,*20Max&Swjd=10288&Swsvc=12u189&Swop=4&Syr=2024&From=!165a1348h-wcont-&Submit=ViewTrd__;KiolKiol!!K-Hz7m0Vt54!iOrOjgdCl0kQ_NSYaL4tzdDin0ZEU52h-jxQD6UngJZzo_XaNNd4Xaf0skN4QHNb5nqKQz6-MV-N1w$>\r\n' +
          '\r\n' +
          '\r\n' +
          '(pid: 2356559) jqs: File=%21165a1341hnew_31778&Syr=2024&Page=Swca&Rsel=%21165a1341h2mea52Q212R&Ui=24*211*Chestnut%2C+Connor&Month=11-24&Swjd=10169&Swsvc=12u189&Rsel=59&Ui=24*257*Jentzsch%2C+Max&Swjd=10288&Swsvc=12u189&Swop=4&Syr=2024&Swjd=10169&Swsvc=12u189&Rsel=59&Ui=24*257*Jentzsch%2C+Max&Swjd=10288&Swsvc=12u189&Swop=4&Syr=2024&Submit=Accept+switch&Enote=Note\r\n',
      },
    };
    expect(parseAmionEmail(email, readData(), true)).toMatchInlineSnapshot(`
      {
        "kind": "not-relevant",
      }
    `);
  });
});

describe('test', () => {
  it('test', () => {
    const email: ApplyAmionChangeRequest = {
      auth: 'test',
      initialTry: true,
      email: {
        subject: 'FW: Approved trade between Alex Jacobs & Connor Chestnut',
        body:
          '\r\n' +
          '________________________________\r\n' +
          'From: Amion (no reply) <noreply@amion.com>\r\n' +
          'Sent: Sunday, September 15, 2024 10:20:22 PM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
          'To: Chloe E Peters <cepeters@uw.edu>\r\n' +
          'Cc: Renee Kyle <drkyle@uw.edu>; Amy Say <amysay91@uw.edu>\r\n' +
          'Subject: Approved trade between Alex Jacobs & Connor Chestnut\r\n' +
          '\r\n' +
          "Connor Chestnut is taking Alex Jacobs's HMC Night on Tue. Mar 4.\r\n" +
          '\r\n',
      },
    };
    expect(parseAmionEmail(email, readData(), true)).toMatchInlineSnapshot(`
      {
        "changes": [
          {
            "kind": "regular",
            "next": "CC",
            "previous": "AJ",
            "shift": {
              "dayIndex": 2,
              "shiftName": "weekday_south",
              "weekIndex": 35,
            },
          },
        ],
        "kind": "changes",
      }
    `);
  });
});

describe('test', () => {
  it('test', () => {
    const email: ApplyAmionChangeRequest = {
      auth: 'test',
      initialTry: true,
      email: {
        subject: 'FW: Approved trade between Alex Jacobs & Connor Chestnut',
        body:
          '\r\n' +
          '________________________________\r\n' +
          'From: Amion (no reply) <noreply@amion.com>\r\n' +
          'Sent: Sunday, September 15, 2024 10:20:14 PM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
          'To: Chloe E Peters <cepeters@uw.edu>\r\n' +
          'Cc: Renee Kyle <drkyle@uw.edu>; Amy Say <amysay91@uw.edu>\r\n' +
          'Subject: Approved trade between Alex Jacobs & Connor Chestnut\r\n' +
          '\r\n' +
          "Connor Chestnut is taking Alex Jacobs's VA Night on Tue. Mar 4.\r\n" +
          '\r\n',
      },
    };
    expect(parseAmionEmail(email, readData(), true)).toMatchInlineSnapshot(`
      {
        "kind": "not-relevant",
      }
    `);
  });
});

describe('test', () => {
  it('test', () => {
    const email: ApplyAmionChangeRequest = {
      auth: 'test',
      initialTry: true,
      email: {
        subject: 'FW: Changes to your Amion schedule',
        body:
          '\r\n' +
          '________________________________\r\n' +
          'From: Amion schedule update <noreply@amion.com>\r\n' +
          'Sent: Friday, September 27, 2024 2:27:14 AM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
          'To: Chloe E Peters <cepeters@uw.edu>\r\n' +
          'Subject: Changes to your Amion schedule\r\n' +
          '\r\n' +
          "This message should go to Brian Jordan but Amion doesn't have an email address for him/her.\r\n" +
          '\r\n' +
          "Open the schedule in OnCall. Put a block schedule on screen and click a person's name in the left-most column. The top field in the lower left of the Infobox (the blue i on the main toolbar) is for email addresses.\r\n" +
          '\r\n' +
          'Changes to your Amion work schedule<https://urldefense.com/v3/__http://www.amion.com/cgi-bin/ocs?Lo=urology&Ps=!1h4mna23Q152R&Mo=10-24__;!!K-Hz7m0Vt54!kEkXLL2NGk0oXBA5XabdRB0zOWKWlYcS_BIJf8FN6vICYhula2Qx6U9gDujeUCqoyQ5a6Q7OrUMftw$>:\r\n' +
          '\r\n' +
          "You've been scheduled for Attending North Night on 10-9-24.\r\n" +
          "You've been scheduled for Attending North Night on 10-16-24.\r\n" +
          "You've been scheduled for Attending North Night on 10-29-24.\r\n" +
          "You've been scheduled for Attending North Night on 10-31-24.\r\n" +
          '\r\n' +
          'jqs: Lo=urology&Msgo=25\r\n',
      },
    };
    expect(parseAmionEmail(email, readData(), true)).toMatchInlineSnapshot(`
      {
        "kind": "not-relevant",
      }
    `);
  });
});

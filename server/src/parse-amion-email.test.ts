
import {
  TinyEmail,
  parseAmionEmails,
  summarizeEmailParseResults,
} from './parse-amion-email';
import { CallSchedule } from './shared/types';
import { loadStorage } from './storage';

// spell-checker:disable

function readData(): CallSchedule {
  const storage = loadStorage({
    noCheck: true,
    academicYear: '24',
  });
  return storage.versions[storage.versions.length - 1].callSchedule;
}

function parseAmionEmailsTest(emails: TinyEmail[]) {
  return summarizeEmailParseResults(parseAmionEmails(emails, readData(), true));
}

it('2024-09-23', () => {
  const emails: TinyEmail[] = [
    {
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
    {
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
  ];
  expect(parseAmionEmailsTest(emails)).toMatchInlineSnapshot(`
    "Email: FW: Pending trade between Connor Chestnut & Max Jentzsch
    Found 2 items: 2 actions, 0 ignored [pending]
     1. 'Max Jentzsch takes Connor Chestnut's HMC Night on Sun. Nov 3.'
        -> 'MJ' is replacing 'CC' for 'HMC Night' on '2024-11-03' (sun)'
        -> Action: 2024-11-03 weekday_south: CC -> MJ
     2. 'Connor Chestnut takes Max Jentzsch's HMC Night on Sun. Mar 2.'
        -> 'CC' is replacing 'MJ' for 'HMC Night' on '2025-03-02' (sun)'
        -> Action: 2025-03-02 weekday_south: MJ -> CC


    Email: FW: Pending trade between Connor Chestnut & Max Jentzsch
    Found 2 items: 0 actions, 2 ignored [pending]
     1. 'Max Jentzsch takes Connor Chestnut's VA Night on Sun. Nov 3.'
        -> 'MJ' is replacing 'CC' for 'VA Night' on '2024-11-03' (sun)'
        -> Ignored: Ignoring VA Night shift, because we react to HMC instead.
     2. 'Connor Chestnut takes Max Jentzsch's VA Night on Sun. Mar 2.'
        -> 'CC' is replacing 'MJ' for 'VA Night' on '2025-03-02' (sun)'
        -> Ignored: Ignoring VA Night shift, because we react to HMC instead."
  `);
});

it('2024-09-15', () => {
  const emails: TinyEmail[] = [
    {
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
    {
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
  ];
  expect(parseAmionEmailsTest(emails)).toMatchInlineSnapshot(`
    "Email: FW: Approved trade between Alex Jacobs & Connor Chestnut
    Found 1 items: 1 actions, 0 ignored [approved]
     1. 'Connor Chestnut is taking Alex Jacobs's HMC Night on Tue. Mar 4.'
        -> 'CC' is replacing 'AJ' for 'HMC Night' on '2025-03-04' (tue)'
        -> Action: 2025-03-04 weekday_south: AJ -> CC


    Email: FW: Approved trade between Alex Jacobs & Connor Chestnut
    Found 1 items: 0 actions, 1 ignored [approved]
     1. 'Connor Chestnut is taking Alex Jacobs's VA Night on Tue. Mar 4.'
        -> 'CC' is replacing 'AJ' for 'VA Night' on '2025-03-04' (tue)'
        -> Ignored: Ignoring VA Night shift, because we react to HMC instead."
  `);
});

it('changes-to-schedule', () => {
  const email = {
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
  };
  expect(parseAmionEmailsTest([email])).toMatchInlineSnapshot(`
    "Email: FW: Changes to your Amion schedule
    Ignored (not relevant)"
  `);
});

it('2024-10-16 approved', () => {
  const emails: TinyEmail[] = [
    {
      subject: 'FW: Approved trade between Lillian Xie & Rilwan Babajide',
      body:
        '\r\n' +
        '________________________________\r\n' +
        'From: Amion (no reply) <noreply@amion.com>\r\n' +
        'Sent: Wednesday, October 16, 2024 4:33:52 PM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
        'To: Diboro L Kanabolo <kanabolo@uw.edu>\r\n' +
        'Cc: Renee Kyle <drkyle@uw.edu>; Amy Say <amysay91@uw.edu>\r\n' +
        'Subject: Approved trade between Lillian Xie & Rilwan Babajide\r\n' +
        '\r\n' +
        "Rilwan Babajide is taking Lillian Xie's HMC Day Inpatient on Sun. Jan 26.\r\n" +
        '\r\n' +
        "Lillian Xie takes Rilwan Babajide's HMC Day Inpatient on Sun. Jan 19 in return.\r\n" +
        '\r\n',
    },
    {
      subject: 'FW: Approved trade between Lillian Xie & Rilwan Babajide',
      body:
        '\r\n' +
        '________________________________\r\n' +
        'From: Amion (no reply) <noreply@amion.com>\r\n' +
        'Sent: Wednesday, October 16, 2024 4:33:45 PM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
        'To: Diboro L Kanabolo <kanabolo@uw.edu>\r\n' +
        'Cc: Renee Kyle <drkyle@uw.edu>; Amy Say <amysay91@uw.edu>\r\n' +
        'Subject: Approved trade between Lillian Xie & Rilwan Babajide\r\n' +
        '\r\n' +
        "Rilwan Babajide is taking Lillian Xie's VA Day Inpatients on Sun. Jan 26.\r\n" +
        '\r\n' +
        "Lillian Xie takes Rilwan Babajide's VA Day Inpatients on Sun. Jan 19 in return.\r\n" +
        '\r\n',
    },
    {
      subject: 'FW: Approved trade between Lillian Xie & Rilwan Babajide',
      body:
        '\r\n' +
        '________________________________\r\n' +
        'From: Amion (no reply) <noreply@amion.com>\r\n' +
        'Sent: Wednesday, October 16, 2024 4:33:21 PM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
        'To: Diboro L Kanabolo <kanabolo@uw.edu>\r\n' +
        'Cc: Renee Kyle <drkyle@uw.edu>; Amy Say <amysay91@uw.edu>\r\n' +
        'Subject: Approved trade between Lillian Xie & Rilwan Babajide\r\n' +
        '\r\n' +
        "Rilwan Babajide is taking Lillian Xie's VA Day Consults on Sun. Jan 26.\r\n" +
        '\r\n' +
        "Lillian Xie takes Rilwan Babajide's VA Day Consults on Sun. Jan 19 in return.\r\n" +
        '\r\n',
    },
    {
      subject: 'FW: Approved trade between Lillian Xie & Rilwan Babajide',
      body:
        '\r\n' +
        '________________________________\r\n' +
        'From: Amion (no reply) <noreply@amion.com>\r\n' +
        'Sent: Wednesday, October 16, 2024 4:33:11 PM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
        'To: Diboro L Kanabolo <kanabolo@uw.edu>\r\n' +
        'Cc: Renee Kyle <drkyle@uw.edu>; Amy Say <amysay91@uw.edu>\r\n' +
        'Subject: Approved trade between Lillian Xie & Rilwan Babajide\r\n' +
        '\r\n' +
        "Rilwan Babajide is taking Lillian Xie's HMC Day Consult on Sun. Jan 26.\r\n" +
        '\r\n' +
        "Lillian Xie takes Rilwan Babajide's HMC Day Consult on Sun. Jan 19 in return.\r\n" +
        '\r\n',
    },
    {
      subject: 'FW: Approved trade between Lillian Xie & Rilwan Babajide',
      body:
        '\r\n' +
        '________________________________\r\n' +
        'From: Amion (no reply) <noreply@amion.com>\r\n' +
        'Sent: Wednesday, October 16, 2024 4:33:06 PM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
        'To: Diboro L Kanabolo <kanabolo@uw.edu>\r\n' +
        'Cc: Renee Kyle <drkyle@uw.edu>; Amy Say <amysay91@uw.edu>\r\n' +
        'Subject: Approved trade between Lillian Xie & Rilwan Babajide\r\n' +
        '\r\n' +
        "Rilwan Babajide is taking Lillian Xie's VA Day Inpatients on Sat. Jan 25.\r\n" +
        '\r\n' +
        "Lillian Xie takes Rilwan Babajide's VA Day Inpatients on Sat. Jan 18 in return.\r\n" +
        '\r\n',
    },
    {
      subject: 'FW: Approved trade between Lillian Xie & Rilwan Babajide',
      body:
        '\r\n' +
        '________________________________\r\n' +
        'From: Amion (no reply) <noreply@amion.com>\r\n' +
        'Sent: Wednesday, October 16, 2024 4:32:55 PM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
        'To: Diboro L Kanabolo <kanabolo@uw.edu>\r\n' +
        'Cc: Renee Kyle <drkyle@uw.edu>; Amy Say <amysay91@uw.edu>\r\n' +
        'Subject: Approved trade between Lillian Xie & Rilwan Babajide\r\n' +
        '\r\n' +
        "Rilwan Babajide is taking Lillian Xie's VA Day Consults on Sat. Jan 25.\r\n" +
        '\r\n' +
        "Lillian Xie takes Rilwan Babajide's VA Day Consults on Sat. Jan 18 in return.\r\n" +
        '\r\n',
    },
    {
      subject: 'FW: Approved trade between Lillian Xie & Rilwan Babajide',
      body:
        '\r\n' +
        '________________________________\r\n' +
        'From: Amion (no reply) <noreply@amion.com>\r\n' +
        'Sent: Wednesday, October 16, 2024 4:32:37 PM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
        'To: Diboro L Kanabolo <kanabolo@uw.edu>\r\n' +
        'Cc: Renee Kyle <drkyle@uw.edu>; Amy Say <amysay91@uw.edu>\r\n' +
        'Subject: Approved trade between Lillian Xie & Rilwan Babajide\r\n' +
        '\r\n' +
        "Rilwan Babajide is taking Lillian Xie's HMC Day Consult on Sat. Jan 25.\r\n" +
        '\r\n' +
        "Lillian Xie takes Rilwan Babajide's HMC Day Consult on Sat. Jan 18 in return.\r\n" +
        '\r\n',
    },
    {
      subject: 'FW: Approved trade between Lillian Xie & Rilwan Babajide',
      body:
        '\r\n' +
        '________________________________\r\n' +
        'From: Amion (no reply) <noreply@amion.com>\r\n' +
        'Sent: Wednesday, October 16, 2024 4:32:43 PM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
        'To: Diboro L Kanabolo <kanabolo@uw.edu>\r\n' +
        'Cc: Renee Kyle <drkyle@uw.edu>; Amy Say <amysay91@uw.edu>\r\n' +
        'Subject: Approved trade between Lillian Xie & Rilwan Babajide\r\n' +
        '\r\n' +
        "Rilwan Babajide is taking Lillian Xie's HMC Day Inpatient on Sat. Jan 25.\r\n" +
        '\r\n' +
        "Lillian Xie takes Rilwan Babajide's HMC Day Inpatient on Sat. Jan 18 in return.\r\n" +
        '\r\n',
    },
    {
      subject: 'FW: Approved trade between Lillian Xie & Rilwan Babajide',
      body:
        '\r\n' +
        '________________________________\r\n' +
        'From: Amion (no reply) <noreply@amion.com>\r\n' +
        'Sent: Wednesday, October 16, 2024 4:32:31 PM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
        'To: Diboro L Kanabolo <kanabolo@uw.edu>\r\n' +
        'Cc: Renee Kyle <drkyle@uw.edu>; Amy Say <amysay91@uw.edu>; loftusc@uw.edu <loftusc@uw.edu>; rsekar@uw.edu <rsekar@uw.edu>; colonnat@uw.edu <colonnat@uw.edu>; ekc90@uw.edu <ekc90@uw.edu>; Dani Townsend <dtowns@uw.edu>\r\n' +
        'Subject: Approved trade between Lillian Xie & Rilwan Babajide\r\n' +
        '\r\n' +
        "Rilwan Babajide is taking Lillian Xie's HMC Night on Sat. Jan 25.\r\n" +
        '\r\n' +
        "Lillian Xie takes Rilwan Babajide's HMC Night on Sat. Jan 18 in return.\r\n" +
        '\r\n',
    },
    {
      subject: 'FW: Approved trade between Lillian Xie & Rilwan Babajide',
      body:
        '\r\n' +
        '________________________________\r\n' +
        'From: Amion (no reply) <noreply@amion.com>\r\n' +
        'Sent: Wednesday, October 16, 2024 4:32:03 PM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
        'To: Diboro L Kanabolo <kanabolo@uw.edu>\r\n' +
        'Cc: Renee Kyle <drkyle@uw.edu>; Amy Say <amysay91@uw.edu>; loftusc@uw.edu <loftusc@uw.edu>; rsekar@uw.edu <rsekar@uw.edu>; colonnat@uw.edu <colonnat@uw.edu>; ekc90@uw.edu <ekc90@uw.edu>; Dani Townsend <dtowns@uw.edu>\r\n' +
        'Subject: Approved trade between Lillian Xie & Rilwan Babajide\r\n' +
        '\r\n' +
        "Lillian Xie is taking Rilwan Babajide's HMC Night on Sun. Jan 19.\r\n" +
        '\r\n',
    },
    {
      subject: 'FW: Approved trade between Lillian Xie & Rilwan Babajide',
      body:
        '\r\n' +
        '________________________________\r\n' +
        'From: Amion (no reply) <noreply@amion.com>\r\n' +
        'Sent: Wednesday, October 16, 2024 4:30:25 PM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
        'To: Diboro L Kanabolo <kanabolo@uw.edu>\r\n' +
        'Cc: Renee Kyle <drkyle@uw.edu>; Amy Say <amysay91@uw.edu>; loftusc@uw.edu <loftusc@uw.edu>; rsekar@uw.edu <rsekar@uw.edu>; colonnat@uw.edu <colonnat@uw.edu>; ekc90@uw.edu <ekc90@uw.edu>; Dani Townsend <dtowns@uw.edu>\r\n' +
        'Subject: Approved trade between Lillian Xie & Rilwan Babajide\r\n' +
        '\r\n' +
        "Rilwan Babajide is taking Lillian Xie's HMC Night on Fri. Jan 24.\r\n" +
        '\r\n' +
        "Lillian Xie takes Rilwan Babajide's HMC Night on Fri. Jan 17 in return.\r\n" +
        '\r\n',
    },
  ];
  expect(parseAmionEmailsTest(emails)).toMatchInlineSnapshot(`
    "Email: FW: Approved trade between Lillian Xie & Rilwan Babajide
    Found 2 items: 0 actions, 2 ignored [approved]
     1. 'Rilwan Babajide is taking Lillian Xie's HMC Day Inpatient on Sun. Jan 26.'
        -> 'RB' is replacing 'LX' for 'HMC Day Inpatient' on '2025-01-26' (sun)'
        -> Ignored: Ignoring 'HMC Day Inpatient' on '2025-01-26' because we react to the Friday shift instead (validated against 'weekend_south' on '2025-01-24' (fri)).
     2. 'Lillian Xie takes Rilwan Babajide's HMC Day Inpatient on Sun. Jan 19'
        -> 'LX' is replacing 'RB' for 'HMC Day Inpatient' on '2025-01-19' (sun)'
        -> Ignored: Ignoring 'HMC Day Inpatient' on '2025-01-19' because we react to the Friday shift instead (validated against 'south_power' on '2025-01-17' (fri)).


    Email: FW: Approved trade between Lillian Xie & Rilwan Babajide
    Found 2 items: 0 actions, 2 ignored [approved]
     1. 'Rilwan Babajide is taking Lillian Xie's VA Day Inpatients on Sun. Jan 26.'
        -> 'RB' is replacing 'LX' for 'VA Day Inpatients' on '2025-01-26' (sun)'
        -> Ignored: Ignoring VA Day Inpatients shift, because we react to HMC instead.
     2. 'Lillian Xie takes Rilwan Babajide's VA Day Inpatients on Sun. Jan 19'
        -> 'LX' is replacing 'RB' for 'VA Day Inpatients' on '2025-01-19' (sun)'
        -> Ignored: Ignoring VA Day Inpatients shift, because we react to HMC instead.


    Email: FW: Approved trade between Lillian Xie & Rilwan Babajide
    Found 2 items: 0 actions, 2 ignored [approved]
     1. 'Rilwan Babajide is taking Lillian Xie's VA Day Consults on Sun. Jan 26.'
        -> 'RB' is replacing 'LX' for 'VA Day Consults' on '2025-01-26' (sun)'
        -> Ignored: Ignoring VA Day Consults shift, because we react to HMC instead.
     2. 'Lillian Xie takes Rilwan Babajide's VA Day Consults on Sun. Jan 19'
        -> 'LX' is replacing 'RB' for 'VA Day Consults' on '2025-01-19' (sun)'
        -> Ignored: Ignoring VA Day Consults shift, because we react to HMC instead.


    Email: FW: Approved trade between Lillian Xie & Rilwan Babajide
    Found 2 items: 0 actions, 2 ignored [approved]
     1. 'Rilwan Babajide is taking Lillian Xie's HMC Day Consult on Sun. Jan 26.'
        -> 'RB' is replacing 'LX' for 'HMC Day Consult' on '2025-01-26' (sun)'
        -> Ignored: Ignoring 'HMC Day Consult' on '2025-01-26' because we react to the Friday shift instead (validated against 'weekend_south' on '2025-01-24' (fri)).
     2. 'Lillian Xie takes Rilwan Babajide's HMC Day Consult on Sun. Jan 19'
        -> 'LX' is replacing 'RB' for 'HMC Day Consult' on '2025-01-19' (sun)'
        -> Ignored: Ignoring 'HMC Day Consult' on '2025-01-19' because we react to the Friday shift instead (validated against 'south_power' on '2025-01-17' (fri)).


    Email: FW: Approved trade between Lillian Xie & Rilwan Babajide
    Found 2 items: 0 actions, 2 ignored [approved]
     1. 'Rilwan Babajide is taking Lillian Xie's VA Day Inpatients on Sat. Jan 25.'
        -> 'RB' is replacing 'LX' for 'VA Day Inpatients' on '2025-01-25' (sat)'
        -> Ignored: Ignoring VA Day Inpatients shift, because we react to HMC instead.
     2. 'Lillian Xie takes Rilwan Babajide's VA Day Inpatients on Sat. Jan 18'
        -> 'LX' is replacing 'RB' for 'VA Day Inpatients' on '2025-01-18' (sat)'
        -> Ignored: Ignoring VA Day Inpatients shift, because we react to HMC instead.


    Email: FW: Approved trade between Lillian Xie & Rilwan Babajide
    Found 2 items: 0 actions, 2 ignored [approved]
     1. 'Rilwan Babajide is taking Lillian Xie's VA Day Consults on Sat. Jan 25.'
        -> 'RB' is replacing 'LX' for 'VA Day Consults' on '2025-01-25' (sat)'
        -> Ignored: Ignoring VA Day Consults shift, because we react to HMC instead.
     2. 'Lillian Xie takes Rilwan Babajide's VA Day Consults on Sat. Jan 18'
        -> 'LX' is replacing 'RB' for 'VA Day Consults' on '2025-01-18' (sat)'
        -> Ignored: Ignoring VA Day Consults shift, because we react to HMC instead.


    Email: FW: Approved trade between Lillian Xie & Rilwan Babajide
    Found 2 items: 0 actions, 2 ignored [approved]
     1. 'Rilwan Babajide is taking Lillian Xie's HMC Day Consult on Sat. Jan 25.'
        -> 'RB' is replacing 'LX' for 'HMC Day Consult' on '2025-01-25' (sat)'
        -> Ignored: Ignoring 'HMC Day Consult' on '2025-01-25' because we react to the Friday shift instead (validated against 'weekend_south' on '2025-01-24' (fri)).
     2. 'Lillian Xie takes Rilwan Babajide's HMC Day Consult on Sat. Jan 18'
        -> 'LX' is replacing 'RB' for 'HMC Day Consult' on '2025-01-18' (sat)'
        -> Ignored: Ignoring 'HMC Day Consult' on '2025-01-18' because we react to the Friday shift instead (validated against 'south_power' on '2025-01-17' (fri)).


    Email: FW: Approved trade between Lillian Xie & Rilwan Babajide
    Found 2 items: 0 actions, 2 ignored [approved]
     1. 'Rilwan Babajide is taking Lillian Xie's HMC Day Inpatient on Sat. Jan 25.'
        -> 'RB' is replacing 'LX' for 'HMC Day Inpatient' on '2025-01-25' (sat)'
        -> Ignored: Ignoring 'HMC Day Inpatient' on '2025-01-25' because we react to the Friday shift instead (validated against 'weekend_south' on '2025-01-24' (fri)).
     2. 'Lillian Xie takes Rilwan Babajide's HMC Day Inpatient on Sat. Jan 18'
        -> 'LX' is replacing 'RB' for 'HMC Day Inpatient' on '2025-01-18' (sat)'
        -> Ignored: Ignoring 'HMC Day Inpatient' on '2025-01-18' because we react to the Friday shift instead (validated against 'south_power' on '2025-01-17' (fri)).


    Email: FW: Approved trade between Lillian Xie & Rilwan Babajide
    Found 2 items: 0 actions, 2 ignored [approved]
     1. 'Rilwan Babajide is taking Lillian Xie's HMC Night on Sat. Jan 25.'
        -> 'RB' is replacing 'LX' for 'HMC Night' on '2025-01-25' (sat)'
        -> Ignored: Ignoring 'HMC Night' on '2025-01-25' because we react to the Friday shift instead (validated against 'weekend_south' on '2025-01-24' (fri)).
     2. 'Lillian Xie takes Rilwan Babajide's HMC Night on Sat. Jan 18'
        -> 'LX' is replacing 'RB' for 'HMC Night' on '2025-01-18' (sat)'
        -> Ignored: Ignoring 'HMC Night' on '2025-01-18' because we react to the Friday shift instead (validated against 'south_power' on '2025-01-17' (fri)).


    Email: FW: Approved trade between Lillian Xie & Rilwan Babajide
    Found 1 items: 0 actions, 1 ignored [approved]
     1. 'Lillian Xie is taking Rilwan Babajide's HMC Night on Sun. Jan 19.'
        -> 'LX' is replacing 'RB' for 'HMC Night' on '2025-01-19' (sun)'
        -> Ignored: Ignoring 'HMC Night' on '2025-01-19' because we react to the Friday shift instead (validated against 'south_power' on '2025-01-17' (fri)).


    Email: FW: Approved trade between Lillian Xie & Rilwan Babajide
    Found 2 items: 2 actions, 0 ignored [approved]
     1. 'Rilwan Babajide is taking Lillian Xie's HMC Night on Fri. Jan 24.'
        -> 'RB' is replacing 'LX' for 'HMC Night' on '2025-01-24' (fri)'
        -> Action: 2025-01-24 weekend_south: LX -> RB
     2. 'Lillian Xie takes Rilwan Babajide's HMC Night on Fri. Jan 17'
        -> 'LX' is replacing 'RB' for 'HMC Night' on '2025-01-17' (fri)'
        -> Action: 2025-01-17 south_power: RB -> LX"
  `);
});

it('2024-10-16 pending', () => {
  const emails: TinyEmail[] = [
    {
      subject: 'FW: Pending trade between Lillian Xie & Rilwan Babajide',
      body:
        '\r\n' +
        '________________________________\r\n' +
        'From: Amion (no reply) <noreply@amion.com>\r\n' +
        'Sent: Wednesday, October 16, 2024 10:50:18 AM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
        'To: Diboro L Kanabolo <kanabolo@uw.edu>\r\n' +
        'Cc: Renee Kyle <drkyle@uw.edu>; Amy Say <amysay91@uw.edu>\r\n' +
        'Subject: Pending trade between Lillian Xie & Rilwan Babajide\r\n' +
        '\r\n' +
        'A trade awaits your approval:\r\n' +
        '\r\n' +
        "Rilwan Babajide takes Lillian Xie's HMC Night on Fri. Jan 24.\r\n" +
        "Lillian Xie takes Rilwan Babajide's HMC Night on Fri. Jan 17.\r\n" +
        '\r\n' +
        'Allow<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!167842ddh3mla51Q210R&Ui=24*209*Xie,*20Lillian&Swjd=10251&Swsvc=4u159&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10244&Swsvc=4u159&Swop=4&Syr=2024&From=!167842ddh-wcont-&Submit=Accept*switch__;KiolKiolKw!!K-Hz7m0Vt54!jVbZuEoOW2P6c-pvvGRhV_PNhAHUxl52sfKRSsgvHCNb9cONVkO_4crZymsRmlZkdZ9dcn-tthTcAQ$>             Decline<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!167842ddh3mla51Q210R&Ui=24*209*Xie,*20Lillian&Swjd=10251&Swsvc=4u159&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10244&Swsvc=4u159&Swop=4&Syr=2024&From=!167842ddh-wcont-&Submit=Can*27t*do*it__;KiolKiolJSsr!!K-Hz7m0Vt54!jVbZuEoOW2P6c-pvvGRhV_PNhAHUxl52sfKRSsgvHCNb9cONVkO_4crZymsRmlZkdZ9dcn808gSZzQ$>             Look before deciding<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!167842ddh3mla51Q210R&Ui=24*209*Xie,*20Lillian&Swjd=10251&Swsvc=4u159&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10244&Swsvc=4u159&Swop=4&Syr=2024&From=!167842ddh-wcont-&Submit=ViewTrd__;KiolKiol!!K-Hz7m0Vt54!jVbZuEoOW2P6c-pvvGRhV_PNhAHUxl52sfKRSsgvHCNb9cONVkO_4crZymsRmlZkdZ9dcn9bycHjpg$>\r\n' +
        '\r\n' +
        '\r\n' +
        '(pid: 2217358) jqs: File=%21167842dahnew_31778&Syr=2024&Page=Swca&Rsel=%21167842dah0mxa48Q209R&Ui=24*209*Xie%2C+Lillian&Month=1-25&Swjd=10251&Swsvc=4u159&Rsel=57&Ui=24*255*Babajide%2C+Rilwan&Swjd=10244&Swsvc=4u159&Swop=4&Syr=2024&Swjd=10251&Swsvc=4u159&Rsel=57&Ui=24*255*Babajide%2C+Rilwan&Swjd=10244&Swsvc=4u159&Swop=4&Syr=2024&Submit=Accept+switch&Enote=Note\r\n',
    },
    {
      subject: 'FW: Pending trade between Lillian Xie & Rilwan Babajide',
      body:
        '\r\n' +
        '________________________________\r\n' +
        'From: Amion (no reply) <noreply@amion.com>\r\n' +
        'Sent: Wednesday, October 16, 2024 10:48:33 AM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
        'To: Diboro L Kanabolo <kanabolo@uw.edu>\r\n' +
        'Cc: Renee Kyle <drkyle@uw.edu>; Amy Say <amysay91@uw.edu>\r\n' +
        'Subject: Pending trade between Lillian Xie & Rilwan Babajide\r\n' +
        '\r\n' +
        'A trade awaits your approval:\r\n' +
        '\r\n' +
        "Lillian Xie takes Rilwan Babajide's HMC Night on Sun. Jan 19.\r\n" +
        '\r\n' +
        'Allow<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!16784274h6mla54Q212R&Ui=24*209*Xie,*20Lillian&Swjd=10149&Swsvc=-1u0&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10246&Swsvc=4u159&Swop=4&Syr=2024&From=!16784274h-wcont-&Submit=Accept*switch__;KiolKiolKw!!K-Hz7m0Vt54!gK-YJ13YXonSScoki6mJh0mjMcfbSYQVu0wQsXNcytcCdp6TlPjM4ZcCXqdK2wGQDwlXw-CxPADj3g$>             Decline<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!16784274h6mla54Q212R&Ui=24*209*Xie,*20Lillian&Swjd=10149&Swsvc=-1u0&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10246&Swsvc=4u159&Swop=4&Syr=2024&From=!16784274h-wcont-&Submit=Can*27t*do*it__;KiolKiolJSsr!!K-Hz7m0Vt54!gK-YJ13YXonSScoki6mJh0mjMcfbSYQVu0wQsXNcytcCdp6TlPjM4ZcCXqdK2wGQDwlXw-Bc7USwLA$>             Look before deciding<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!16784274h6mla54Q212R&Ui=24*209*Xie,*20Lillian&Swjd=10149&Swsvc=-1u0&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10246&Swsvc=4u159&Swop=4&Syr=2024&From=!16784274h-wcont-&Submit=ViewTrd__;KiolKiol!!K-Hz7m0Vt54!gK-YJ13YXonSScoki6mJh0mjMcfbSYQVu0wQsXNcytcCdp6TlPjM4ZcCXqdK2wGQDwlXw-BLFizMrw$>\r\n' +
        '\r\n' +
        '\r\n' +
        '(pid: 2210295) jqs: File=%2116784271hnew_31778&Syr=2024&Page=Swca&Rsel=%2116784271h3mla51Q210R&Ui=24*209*Xie%2C+Lillian&Month=1-25&Swjd=10149&Swsvc=-1u0&Rsel=57&Ui=24*255*Babajide%2C+Rilwan&Swjd=10246&Swsvc=4u159&Swop=4&Syr=2024&Swjd=10149&Swsvc=-1u0&Rsel=57&Ui=24*255*Babajide%2C+Rilwan&Swjd=10246&Swsvc=4u159&Swop=4&Syr=2024&Submit=Accept+switch&Enote=Note\r\n',
    },
    {
      subject: 'FW: Pending trade between Lillian Xie & Rilwan Babajide',
      body:
        '\r\n' +
        '________________________________\r\n' +
        'From: Amion (no reply) <noreply@amion.com>\r\n' +
        'Sent: Wednesday, October 16, 2024 10:47:49 AM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
        'To: Diboro L Kanabolo <kanabolo@uw.edu>\r\n' +
        'Cc: Renee Kyle <drkyle@uw.edu>; Amy Say <amysay91@uw.edu>\r\n' +
        'Subject: Pending trade between Lillian Xie & Rilwan Babajide\r\n' +
        '\r\n' +
        'A trade awaits your approval:\r\n' +
        '\r\n' +
        "Rilwan Babajide takes Lillian Xie's HMC Night on Sat. Jan 25.\r\n" +
        "Lillian Xie takes Rilwan Babajide's HMC Night on Sat. Jan 18.\r\n" +
        '\r\n' +
        'Allow<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!16784248h7mia55Q212R&Ui=24*209*Xie,*20Lillian&Swjd=10252&Swsvc=4u159&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10245&Swsvc=4u159&Swop=4&Syr=2024&From=!16784248h-wcont-&Submit=Accept*switch__;KiolKiolKw!!K-Hz7m0Vt54!kCj_kPsZrsusz2J5bX5zlQXO3OZLSZoXiV95kwPAwNc5AsPRhxSIBwmOipC2WnEWnNBPzTJeECS8jQ$>             Decline<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!16784248h7mia55Q212R&Ui=24*209*Xie,*20Lillian&Swjd=10252&Swsvc=4u159&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10245&Swsvc=4u159&Swop=4&Syr=2024&From=!16784248h-wcont-&Submit=Can*27t*do*it__;KiolKiolJSsr!!K-Hz7m0Vt54!kCj_kPsZrsusz2J5bX5zlQXO3OZLSZoXiV95kwPAwNc5AsPRhxSIBwmOipC2WnEWnNBPzTIr_SkZng$>             Look before deciding<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!16784248h7mia55Q212R&Ui=24*209*Xie,*20Lillian&Swjd=10252&Swsvc=4u159&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10245&Swsvc=4u159&Swop=4&Syr=2024&From=!16784248h-wcont-&Submit=ViewTrd__;KiolKiol!!K-Hz7m0Vt54!kCj_kPsZrsusz2J5bX5zlQXO3OZLSZoXiV95kwPAwNc5AsPRhxSIBwmOipC2WnEWnNBPzTJvDtIrMQ$>\r\n' +
        '\r\n' +
        '\r\n' +
        '(pid: 2207251) jqs: File=%2116784246hnew_31778&Syr=2024&Page=Swca&Rsel=%2116784246h5mla53Q211R&Ui=24*209*Xie%2C+Lillian&Month=1-25&Swjd=10252&Swsvc=4u159&Rsel=57&Ui=24*255*Babajide%2C+Rilwan&Swjd=10245&Swsvc=4u159&Swop=4&Syr=2024&Swjd=10252&Swsvc=4u159&Rsel=57&Ui=24*255*Babajide%2C+Rilwan&Swjd=10245&Swsvc=4u159&Swop=4&Syr=2024&Submit=Accept+switch&Enote=Note\r\n',
    },
    {
      subject: 'FW: Pending trade between Lillian Xie & Rilwan Babajide',
      body:
        '\r\n' +
        '________________________________\r\n' +
        'From: Amion (no reply) <noreply@amion.com>\r\n' +
        'Sent: Wednesday, October 16, 2024 10:47:34 AM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
        'To: Diboro L Kanabolo <kanabolo@uw.edu>\r\n' +
        'Cc: Renee Kyle <drkyle@uw.edu>; Amy Say <amysay91@uw.edu>\r\n' +
        'Subject: Pending trade between Lillian Xie & Rilwan Babajide\r\n' +
        '\r\n' +
        'A trade awaits your approval:\r\n' +
        '\r\n' +
        "Rilwan Babajide takes Lillian Xie's HMC Day Consult on Sat. Jan 25.\r\n" +
        "Lillian Xie takes Rilwan Babajide's HMC Day Consult on Sat. Jan 18.\r\n" +
        '\r\n' +
        'Allow<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!16784239h1mia49Q209R&Ui=24*209*Xie,*20Lillian&Swjd=10252&Swsvc=10u185&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10245&Swsvc=10u185&Swop=4&Syr=2024&From=!16784239h-wcont-&Submit=Accept*switch__;KiolKiolKw!!K-Hz7m0Vt54!iN4ICHSXFXRfpwtqQK-NJ4rVx2h4DjgF4v4zxi9cpdmE02vVpyBHsdcDopj6Z_igyw5798IQQ_lVDA$>             Decline<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!16784239h1mia49Q209R&Ui=24*209*Xie,*20Lillian&Swjd=10252&Swsvc=10u185&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10245&Swsvc=10u185&Swop=4&Syr=2024&From=!16784239h-wcont-&Submit=Can*27t*do*it__;KiolKiolJSsr!!K-Hz7m0Vt54!iN4ICHSXFXRfpwtqQK-NJ4rVx2h4DjgF4v4zxi9cpdmE02vVpyBHsdcDopj6Z_igyw5798KnZhyb5w$>             Look before deciding<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!16784239h1mia49Q209R&Ui=24*209*Xie,*20Lillian&Swjd=10252&Swsvc=10u185&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10245&Swsvc=10u185&Swop=4&Syr=2024&From=!16784239h-wcont-&Submit=ViewTrd__;KiolKiol!!K-Hz7m0Vt54!iN4ICHSXFXRfpwtqQK-NJ4rVx2h4DjgF4v4zxi9cpdmE02vVpyBHsdcDopj6Z_igyw5798LZuTFXnw$>\r\n' +
        '\r\n' +
        '\r\n' +
        '(pid: 2206181) jqs: File=%2116784237hnew_31778&Syr=2024&Page=Swca&Rsel=%2116784237h8maa56Q213R&Ui=24*209*Xie%2C+Lillian&Month=1-25&Swjd=10252&Swsvc=10u185&Rsel=57&Ui=24*255*Babajide%2C+Rilwan&Swjd=10245&Swsvc=10u185&Swop=4&Syr=2024&Swjd=10252&Swsvc=10u185&Rsel=57&Ui=24*255*Babajide%2C+Rilwan&Swjd=10245&Swsvc=10u185&Swop=4&Syr=2024&Submit=Accept+switch&Enote=Note\r\n',
    },
    {
      subject: 'FW: Pending trade between Lillian Xie & Rilwan Babajide',
      body:
        '\r\n' +
        '________________________________\r\n' +
        'From: Amion (no reply) <noreply@amion.com>\r\n' +
        'Sent: Wednesday, October 16, 2024 10:47:26 AM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
        'To: Diboro L Kanabolo <kanabolo@uw.edu>\r\n' +
        'Cc: Renee Kyle <drkyle@uw.edu>; Amy Say <amysay91@uw.edu>\r\n' +
        'Subject: Pending trade between Lillian Xie & Rilwan Babajide\r\n' +
        '\r\n' +
        'A trade awaits your approval:\r\n' +
        '\r\n' +
        "Rilwan Babajide takes Lillian Xie's HMC Day Inpatient on Sat. Jan 25.\r\n" +
        "Lillian Xie takes Rilwan Babajide's HMC Day Inpatient on Sat. Jan 18.\r\n" +
        '\r\n' +
        'Allow<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!16784231h2mea50Q210R&Ui=24*209*Xie,*20Lillian&Swjd=10252&Swsvc=11u187&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10245&Swsvc=11u187&Swop=4&Syr=2024&From=!c6784231s3qiitn3&Submit=Accept*switch__;KiolKiolKw!!K-Hz7m0Vt54!k_HPz2auC0pnFpWU6lqe6iKT163aMQmXwqDCVuV-eF-Q0BCWeQ7dD0mU0zSxVEOQsNGHoUr1qvQb8Q$>             Decline<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!16784231h2mea50Q210R&Ui=24*209*Xie,*20Lillian&Swjd=10252&Swsvc=11u187&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10245&Swsvc=11u187&Swop=4&Syr=2024&From=!c6784231s3qiitn3&Submit=Can*27t*do*it__;KiolKiolJSsr!!K-Hz7m0Vt54!k_HPz2auC0pnFpWU6lqe6iKT163aMQmXwqDCVuV-eF-Q0BCWeQ7dD0mU0zSxVEOQsNGHoUpWlS1DPA$>             Look before deciding<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!16784231h2mea50Q210R&Ui=24*209*Xie,*20Lillian&Swjd=10252&Swsvc=11u187&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10245&Swsvc=11u187&Swop=4&Syr=2024&From=!c6784231s3qiitn3&Submit=ViewTrd__;KiolKiol!!K-Hz7m0Vt54!k_HPz2auC0pnFpWU6lqe6iKT163aMQmXwqDCVuV-eF-Q0BCWeQ7dD0mU0zSxVEOQsNGHoUpG-6coTA$>\r\n' +
        '\r\n' +
        '\r\n' +
        '(pid: 2205689) jqs: File=%211678422fhnew_31778&Syr=2024&Page=Swca&Rsel=%211678422fh0mxa48Q209R&Ui=24*209*Xie%2C+Lillian&Month=1-25&Swjd=10252&Swsvc=11u187&Rsel=57&Ui=24*255*Babajide%2C+Rilwan&Swjd=10245&Swsvc=11u187&Swop=4&Syr=2024&Swjd=10252&Swsvc=11u187&Rsel=57&Ui=24*255*Babajide%2C+Rilwan&Swjd=10245&Swsvc=11u187&Swop=4&Syr=2024&Submit=Accept+switch&Enote=Note\r\n',
    },
    {
      subject: 'FW: Pending trade between Lillian Xie & Rilwan Babajide',
      body:
        '\r\n' +
        '________________________________\r\n' +
        'From: Amion (no reply) <noreply@amion.com>\r\n' +
        'Sent: Wednesday, October 16, 2024 10:46:58 AM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
        'To: Diboro L Kanabolo <kanabolo@uw.edu>\r\n' +
        'Cc: Renee Kyle <drkyle@uw.edu>; Amy Say <amysay91@uw.edu>\r\n' +
        'Subject: Pending trade between Lillian Xie & Rilwan Babajide\r\n' +
        '\r\n' +
        'A trade awaits your approval:\r\n' +
        '\r\n' +
        "Rilwan Babajide takes Lillian Xie's VA Day Consults on Sat. Jan 25.\r\n" +
        "Lillian Xie takes Rilwan Babajide's VA Day Consults on Sat. Jan 18.\r\n" +
        '\r\n' +
        'Allow<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!16784215h1mia49Q209R&Ui=24*209*Xie,*20Lillian&Swjd=10252&Swsvc=13u193&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10245&Swsvc=13u193&Swop=4&Syr=2024&From=!e6784215u4pjhum4&Submit=Accept*switch__;KiolKiolKw!!K-Hz7m0Vt54!ltMJsIu1CaVuASgi5CeKuwcbqaRj6TbbrCCouzOmhY5Y8paBfDLopj1QOy_UUQjgtiAdLeEdQzUonw$>             Decline<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!16784215h1mia49Q209R&Ui=24*209*Xie,*20Lillian&Swjd=10252&Swsvc=13u193&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10245&Swsvc=13u193&Swop=4&Syr=2024&From=!e6784215u4pjhum4&Submit=Can*27t*do*it__;KiolKiolJSsr!!K-Hz7m0Vt54!ltMJsIu1CaVuASgi5CeKuwcbqaRj6TbbrCCouzOmhY5Y8paBfDLopj1QOy_UUQjgtiAdLeHX_IkP2g$>             Look before deciding<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!16784215h1mia49Q209R&Ui=24*209*Xie,*20Lillian&Swjd=10252&Swsvc=13u193&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10245&Swsvc=13u193&Swop=4&Syr=2024&From=!e6784215u4pjhum4&Submit=ViewTrd__;KiolKiol!!K-Hz7m0Vt54!ltMJsIu1CaVuASgi5CeKuwcbqaRj6TbbrCCouzOmhY5Y8paBfDLopj1QOy_UUQjgtiAdLeHJ_Pb0Pg$>\r\n' +
        '\r\n' +
        '\r\n' +
        '(pid: 2203702) jqs: File=%2116784212hnew_31778&Syr=2024&Page=Swca&Rsel=%2116784212h7mia55Q212R&Ui=24*209*Xie%2C+Lillian&Month=1-25&Swjd=10252&Swsvc=13u193&Rsel=57&Ui=24*255*Babajide%2C+Rilwan&Swjd=10245&Swsvc=13u193&Swop=4&Syr=2024&Swjd=10252&Swsvc=13u193&Rsel=57&Ui=24*255*Babajide%2C+Rilwan&Swjd=10245&Swsvc=13u193&Swop=4&Syr=2024&Submit=Accept+switch&Enote=Note\r\n',
    },
    {
      subject: 'FW: Pending trade between Lillian Xie & Rilwan Babajide',
      body:
        '\r\n' +
        '________________________________\r\n' +
        'From: Amion (no reply) <noreply@amion.com>\r\n' +
        'Sent: Wednesday, October 16, 2024 10:46:45 AM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
        'To: Diboro L Kanabolo <kanabolo@uw.edu>\r\n' +
        'Cc: Renee Kyle <drkyle@uw.edu>; Amy Say <amysay91@uw.edu>\r\n' +
        'Subject: Pending trade between Lillian Xie & Rilwan Babajide\r\n' +
        '\r\n' +
        'A trade awaits your approval:\r\n' +
        '\r\n' +
        "Rilwan Babajide takes Lillian Xie's VA Day Consults on Sat. Jan 25.\r\n" +
        "Lillian Xie takes Rilwan Babajide's VA Day Consults on Sat. Jan 18.\r\n" +
        '\r\n' +
        'Allow<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!16784208h6mla54Q212R&Ui=24*209*Xie,*20Lillian&Swjd=10252&Swsvc=13u193&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10245&Swsvc=13u193&Swop=4&Syr=2024&From=!16784208h-wcont-&Submit=Accept*switch__;KiolKiolKw!!K-Hz7m0Vt54!lT3qokFAUxb95im9mcuyqbt283XtaAD55uJYCuW426pb0Ihr2nR-os5rsCT6Y7hpecuYLOsNBqkICA$>             Decline<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!16784208h6mla54Q212R&Ui=24*209*Xie,*20Lillian&Swjd=10252&Swsvc=13u193&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10245&Swsvc=13u193&Swop=4&Syr=2024&From=!16784208h-wcont-&Submit=Can*27t*do*it__;KiolKiolJSsr!!K-Hz7m0Vt54!lT3qokFAUxb95im9mcuyqbt283XtaAD55uJYCuW426pb0Ihr2nR-os5rsCT6Y7hpecuYLOuhiSB7mA$>             Look before deciding<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!16784208h6mla54Q212R&Ui=24*209*Xie,*20Lillian&Swjd=10252&Swsvc=13u193&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10245&Swsvc=13u193&Swop=4&Syr=2024&From=!16784208h-wcont-&Submit=ViewTrd__;KiolKiol!!K-Hz7m0Vt54!lT3qokFAUxb95im9mcuyqbt283XtaAD55uJYCuW426pb0Ihr2nR-os5rsCT6Y7hpecuYLOuLOTnQaA$>\r\n' +
        '\r\n' +
        '\r\n' +
        '(pid: 2202850) jqs: File=%2116784203hnew_31778&Syr=2024&Page=Swca&Rsel=%2116784203h1mia49Q209R&Ui=24*209*Xie%2C+Lillian&Month=1-25&Swjd=10252&Swsvc=13u193&Rsel=57&Ui=24*255*Babajide%2C+Rilwan&Swjd=10245&Swsvc=13u193&Swop=4&Syr=2024&Swjd=10252&Swsvc=13u193&Rsel=57&Ui=24*255*Babajide%2C+Rilwan&Swjd=10245&Swsvc=13u193&Swop=4&Syr=2024&Submit=Accept+switch&Enote=Note\r\n',
    },
    {
      subject: 'FW: Pending trade between Lillian Xie & Rilwan Babajide',
      body:
        '\r\n' +
        '________________________________\r\n' +
        'From: Amion (no reply) <noreply@amion.com>\r\n' +
        'Sent: Wednesday, October 16, 2024 10:46:31 AM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
        'To: Diboro L Kanabolo <kanabolo@uw.edu>\r\n' +
        'Cc: Renee Kyle <drkyle@uw.edu>; Amy Say <amysay91@uw.edu>\r\n' +
        'Subject: Pending trade between Lillian Xie & Rilwan Babajide\r\n' +
        '\r\n' +
        'A trade awaits your approval:\r\n' +
        '\r\n' +
        "Rilwan Babajide takes Lillian Xie's VA Day Inpatients on Sat. Jan 25.\r\n" +
        "Lillian Xie takes Rilwan Babajide's VA Day Inpatients on Sat. Jan 18.\r\n" +
        '\r\n' +
        'Allow<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!167841fah1mia49Q209R&Ui=24*209*Xie,*20Lillian&Swjd=10252&Swsvc=14u195&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10245&Swsvc=14u195&Swop=4&Syr=2024&From=!167841fah-wcont-&Submit=Accept*switch__;KiolKiolKw!!K-Hz7m0Vt54!gaBn_pUANTIMWO2QRobvytTMOAqIxGvL9nDwAlqDsCTwGi3HQg9dF-WnwxyZJ-dlk1R-GhdfczFUdg$>             Decline<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!167841fah1mia49Q209R&Ui=24*209*Xie,*20Lillian&Swjd=10252&Swsvc=14u195&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10245&Swsvc=14u195&Swop=4&Syr=2024&From=!167841fah-wcont-&Submit=Can*27t*do*it__;KiolKiolJSsr!!K-Hz7m0Vt54!gaBn_pUANTIMWO2QRobvytTMOAqIxGvL9nDwAlqDsCTwGi3HQg9dF-WnwxyZJ-dlk1R-Ghd94edMsA$>             Look before deciding<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!167841fah1mia49Q209R&Ui=24*209*Xie,*20Lillian&Swjd=10252&Swsvc=14u195&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10245&Swsvc=14u195&Swop=4&Syr=2024&From=!167841fah-wcont-&Submit=ViewTrd__;KiolKiol!!K-Hz7m0Vt54!gaBn_pUANTIMWO2QRobvytTMOAqIxGvL9nDwAlqDsCTwGi3HQg9dF-WnwxyZJ-dlk1R-GhcryxNuhA$>\r\n' +
        '\r\n' +
        '\r\n' +
        '(pid: 2202006) jqs: File=%21167841f6hnew_31778&Syr=2024&Page=Swca&Rsel=%21167841f6h6mla54Q212R&Ui=24*209*Xie%2C+Lillian&Month=1-25&Swjd=10252&Swsvc=14u195&Rsel=57&Ui=24*255*Babajide%2C+Rilwan&Swjd=10245&Swsvc=14u195&Swop=4&Syr=2024&Swjd=10252&Swsvc=14u195&Rsel=57&Ui=24*255*Babajide%2C+Rilwan&Swjd=10245&Swsvc=14u195&Swop=4&Syr=2024&Submit=Accept+switch&Enote=Note\r\n',
    },
    {
      subject: 'FW: Pending trade between Lillian Xie & Rilwan Babajide',
      body:
        '\r\n' +
        '________________________________\r\n' +
        'From: Amion (no reply) <noreply@amion.com>\r\n' +
        'Sent: Wednesday, October 16, 2024 10:46:17 AM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
        'To: Diboro L Kanabolo <kanabolo@uw.edu>\r\n' +
        'Cc: Renee Kyle <drkyle@uw.edu>; Amy Say <amysay91@uw.edu>\r\n' +
        'Subject: Pending trade between Lillian Xie & Rilwan Babajide\r\n' +
        '\r\n' +
        'A trade awaits your approval:\r\n' +
        '\r\n' +
        "Rilwan Babajide takes Lillian Xie's VA Day Consults on Sun. Jan 26.\r\n" +
        "Lillian Xie takes Rilwan Babajide's VA Day Consults on Sun. Jan 19.\r\n" +
        '\r\n' +
        'Allow<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!167841ebh4mia52Q211R&Ui=24*209*Xie,*20Lillian&Swjd=10253&Swsvc=13u193&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10246&Swsvc=13u193&Swop=4&Syr=2024&From=!167841ebh-wcont-&Submit=Accept*switch__;KiolKiolKw!!K-Hz7m0Vt54!kQnVbs1iaJRWYs8I3rbVsGXVscwhAYo2dSbdfi5zslZLhkYOzpePBwMqGL1qjf_uk0lo9LPtBAIpzA$>             Decline<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!167841ebh4mia52Q211R&Ui=24*209*Xie,*20Lillian&Swjd=10253&Swsvc=13u193&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10246&Swsvc=13u193&Swop=4&Syr=2024&From=!167841ebh-wcont-&Submit=Can*27t*do*it__;KiolKiolJSsr!!K-Hz7m0Vt54!kQnVbs1iaJRWYs8I3rbVsGXVscwhAYo2dSbdfi5zslZLhkYOzpePBwMqGL1qjf_uk0lo9LNuTgySbw$>             Look before deciding<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!167841ebh4mia52Q211R&Ui=24*209*Xie,*20Lillian&Swjd=10253&Swsvc=13u193&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10246&Swsvc=13u193&Swop=4&Syr=2024&From=!167841ebh-wcont-&Submit=ViewTrd__;KiolKiol!!K-Hz7m0Vt54!kQnVbs1iaJRWYs8I3rbVsGXVscwhAYo2dSbdfi5zslZLhkYOzpePBwMqGL1qjf_uk0lo9LP6v0Rufw$>\r\n' +
        '\r\n' +
        '\r\n' +
        '(pid: 2201192) jqs: File=%21167841e9hnew_31778&Syr=2024&Page=Swca&Rsel=%21167841e9h2mea50Q210R&Ui=24*209*Xie%2C+Lillian&Month=1-25&Swjd=10253&Swsvc=13u193&Rsel=57&Ui=24*255*Babajide%2C+Rilwan&Swjd=10246&Swsvc=13u193&Swop=4&Syr=2024&Swjd=10253&Swsvc=13u193&Rsel=57&Ui=24*255*Babajide%2C+Rilwan&Swjd=10246&Swsvc=13u193&Swop=4&Syr=2024&Submit=Accept+switch&Enote=Note\r\n',
    },
    {
      subject: 'FW: Pending trade between Lillian Xie & Rilwan Babajide',
      body:
        '\r\n' +
        '________________________________\r\n' +
        'From: Amion (no reply) <noreply@amion.com>\r\n' +
        'Sent: Wednesday, October 16, 2024 10:45:54 AM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
        'To: Diboro L Kanabolo <kanabolo@uw.edu>\r\n' +
        'Cc: Renee Kyle <drkyle@uw.edu>; Amy Say <amysay91@uw.edu>\r\n' +
        'Subject: Pending trade between Lillian Xie & Rilwan Babajide\r\n' +
        '\r\n' +
        'A trade awaits your approval:\r\n' +
        '\r\n' +
        "Rilwan Babajide takes Lillian Xie's HMC Day Consult on Sun. Jan 26.\r\n" +
        "Lillian Xie takes Rilwan Babajide's HMC Day Consult on Sun. Jan 19.\r\n" +
        '\r\n' +
        'Allow<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!167841d5h0mxa48Q209R&Ui=24*209*Xie,*20Lillian&Swjd=10253&Swsvc=10u185&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10246&Swsvc=10u185&Swop=4&Syr=2024&From=!a67841d5q2rhjso2&Submit=Accept*switch__;KiolKiolKw!!K-Hz7m0Vt54!kb7FboTCRLmwO1TSXYiQp8XA8VAdzVXFWN7M_K3kB51t857rIaMlLWJ82wzNJ7NCEd1kXhvcWjfpgQ$>             Decline<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!167841d5h0mxa48Q209R&Ui=24*209*Xie,*20Lillian&Swjd=10253&Swsvc=10u185&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10246&Swsvc=10u185&Swop=4&Syr=2024&From=!a67841d5q2rhjso2&Submit=Can*27t*do*it__;KiolKiolJSsr!!K-Hz7m0Vt54!kb7FboTCRLmwO1TSXYiQp8XA8VAdzVXFWN7M_K3kB51t857rIaMlLWJ82wzNJ7NCEd1kXhsn95-Qeg$>             Look before deciding<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!167841d5h0mxa48Q209R&Ui=24*209*Xie,*20Lillian&Swjd=10253&Swsvc=10u185&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10246&Swsvc=10u185&Swop=4&Syr=2024&From=!a67841d5q2rhjso2&Submit=ViewTrd__;KiolKiol!!K-Hz7m0Vt54!kb7FboTCRLmwO1TSXYiQp8XA8VAdzVXFWN7M_K3kB51t857rIaMlLWJ82wzNJ7NCEd1kXhucjJ00Xg$>\r\n' +
        '\r\n' +
        '\r\n' +
        '(pid: 2199262) jqs: File=%21167841d2hnew_31778&Syr=2024&Page=Swca&Rsel=%21167841d2h6mla54Q212R&Ui=24*209*Xie%2C+Lillian&Month=1-25&Swjd=10253&Swsvc=10u185&Rsel=57&Ui=24*255*Babajide%2C+Rilwan&Swjd=10246&Swsvc=10u185&Swop=4&Syr=2024&Swjd=10253&Swsvc=10u185&Rsel=57&Ui=24*255*Babajide%2C+Rilwan&Swjd=10246&Swsvc=10u185&Swop=4&Syr=2024&Submit=Accept+switch&Enote=Note\r\n',
    },
    {
      subject: 'FW: Pending trade between Lillian Xie & Rilwan Babajide',
      body:
        '\r\n' +
        '________________________________\r\n' +
        'From: Amion (no reply) <noreply@amion.com>\r\n' +
        'Sent: Wednesday, October 16, 2024 10:46:07 AM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
        'To: Diboro L Kanabolo <kanabolo@uw.edu>\r\n' +
        'Cc: Renee Kyle <drkyle@uw.edu>; Amy Say <amysay91@uw.edu>\r\n' +
        'Subject: Pending trade between Lillian Xie & Rilwan Babajide\r\n' +
        '\r\n' +
        'A trade awaits your approval:\r\n' +
        '\r\n' +
        "Rilwan Babajide takes Lillian Xie's VA Day Inpatients on Sun. Jan 26.\r\n" +
        "Lillian Xie takes Rilwan Babajide's VA Day Inpatients on Sun. Jan 19.\r\n" +
        '\r\n' +
        'Allow<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!167841e2h4mia52Q211R&Ui=24*209*Xie,*20Lillian&Swjd=10253&Swsvc=14u195&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10246&Swsvc=14u195&Swop=4&Syr=2024&From=!867841e2o1sgkrp1&Submit=Accept*switch__;KiolKiolKw!!K-Hz7m0Vt54!gY7hN6nELZ71nErUy8cYiPgGIrz-inhfoCLkq-LWk3-OCA-5jAyBVgCEQ0s73cK87meDbyLDvTyUGw$>             Decline<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!167841e2h4mia52Q211R&Ui=24*209*Xie,*20Lillian&Swjd=10253&Swsvc=14u195&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10246&Swsvc=14u195&Swop=4&Syr=2024&From=!867841e2o1sgkrp1&Submit=Can*27t*do*it__;KiolKiolJSsr!!K-Hz7m0Vt54!gY7hN6nELZ71nErUy8cYiPgGIrz-inhfoCLkq-LWk3-OCA-5jAyBVgCEQ0s73cK87meDbyJlYwk5Pw$>             Look before deciding<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!167841e2h4mia52Q211R&Ui=24*209*Xie,*20Lillian&Swjd=10253&Swsvc=14u195&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10246&Swsvc=14u195&Swop=4&Syr=2024&From=!867841e2o1sgkrp1&Submit=ViewTrd__;KiolKiol!!K-Hz7m0Vt54!gY7hN6nELZ71nErUy8cYiPgGIrz-inhfoCLkq-LWk3-OCA-5jAyBVgCEQ0s73cK87meDbyINMWLJfQ$>\r\n' +
        '\r\n' +
        '\r\n' +
        '(pid: 2200227) jqs: File=%21167841dfhnew_31778&Syr=2024&Page=Swca&Rsel=%21167841dfh1mia49Q209R&Ui=24*209*Xie%2C+Lillian&Month=1-25&Swjd=10253&Swsvc=14u195&Rsel=57&Ui=24*255*Babajide%2C+Rilwan&Swjd=10246&Swsvc=14u195&Swop=4&Syr=2024&Swjd=10253&Swsvc=14u195&Rsel=57&Ui=24*255*Babajide%2C+Rilwan&Swjd=10246&Swsvc=14u195&Swop=4&Syr=2024&Submit=Accept+switch&Enote=Note\r\n',
    },
    {
      subject: 'FW: Pending trade between Lillian Xie & Rilwan Babajide',
      body:
        '\r\n' +
        '________________________________\r\n' +
        'From: Amion (no reply) <noreply@amion.com>\r\n' +
        'Sent: Wednesday, October 16, 2024 10:45:38 AM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
        'To: Diboro L Kanabolo <kanabolo@uw.edu>\r\n' +
        'Cc: Renee Kyle <drkyle@uw.edu>; Amy Say <amysay91@uw.edu>\r\n' +
        'Subject: Pending trade between Lillian Xie & Rilwan Babajide\r\n' +
        '\r\n' +
        'A trade awaits your approval:\r\n' +
        '\r\n' +
        "Rilwan Babajide takes Lillian Xie's HMC Day Inpatient on Sun. Jan 26.\r\n" +
        "Lillian Xie takes Rilwan Babajide's HMC Day Inpatient on Sun. Jan 19.\r\n" +
        '\r\n' +
        'Allow<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!167841c5h2mea50Q210R&Ui=24*209*Xie,*20Lillian&Swjd=10253&Swsvc=11u187&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10246&Swsvc=11u187&Swop=4&Syr=2024&From=!967841c5p1sgkrp1&Submit=Accept*switch__;KiolKiolKw!!K-Hz7m0Vt54!iKaMXbRrGFUx2XmRXj9fXs3xxhl-uv6zYstoj9P-sWe_WpALZSh-7cXIg23T65FXep__BE-fZqwqfw$>             Decline<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!167841c5h2mea50Q210R&Ui=24*209*Xie,*20Lillian&Swjd=10253&Swsvc=11u187&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10246&Swsvc=11u187&Swop=4&Syr=2024&From=!967841c5p1sgkrp1&Submit=Can*27t*do*it__;KiolKiolJSsr!!K-Hz7m0Vt54!iKaMXbRrGFUx2XmRXj9fXs3xxhl-uv6zYstoj9P-sWe_WpALZSh-7cXIg23T65FXep__BE_8IJ3gwA$>             Look before deciding<https://urldefense.com/v3/__https://www.amion.com/cgi-bin/ocs?File=new_31778.sch&Page=Swca&Rsel=!167841c5h2mea50Q210R&Ui=24*209*Xie,*20Lillian&Swjd=10253&Swsvc=11u187&Rsel=57&Ui=24*255*Babajide,*20Rilwan&Swjd=10246&Swsvc=11u187&Swop=4&Syr=2024&From=!967841c5p1sgkrp1&Submit=ViewTrd__;KiolKiol!!K-Hz7m0Vt54!iKaMXbRrGFUx2XmRXj9fXs3xxhl-uv6zYstoj9P-sWe_WpALZSh-7cXIg23T65FXep__BE8v3zsuhw$>\r\n' +
        '\r\n' +
        '\r\n' +
        '(pid: 2198031) jqs: File=%21167841bdhnew_31778&Syr=2024&Page=Swca&Rsel=%21167841bdh3mla51Q210R&Ui=24*209*Xie%2C+Lillian&Month=1-25&Swjd=10253&Swsvc=11u187&Rsel=57&Ui=24*255*Babajide%2C+Rilwan&Swjd=10246&Swsvc=11u187&Swop=4&Syr=2024&Swjd=10253&Swsvc=11u187&Rsel=57&Ui=24*255*Babajide%2C+Rilwan&Swjd=10246&Swsvc=11u187&Swop=4&Syr=2024&Submit=Accept+switch&Enote=Note\r\n',
    },
  ];
  expect(parseAmionEmailsTest(emails)).toMatchInlineSnapshot(`
    "Email: FW: Pending trade between Lillian Xie & Rilwan Babajide
    Found 2 items: 2 actions, 0 ignored [pending]
     1. 'Rilwan Babajide takes Lillian Xie's HMC Night on Fri. Jan 24.'
        -> 'RB' is replacing 'LX' for 'HMC Night' on '2025-01-24' (fri)'
        -> Action: 2025-01-24 weekend_south: LX -> RB
     2. 'Lillian Xie takes Rilwan Babajide's HMC Night on Fri. Jan 17.'
        -> 'LX' is replacing 'RB' for 'HMC Night' on '2025-01-17' (fri)'
        -> Action: 2025-01-17 south_power: RB -> LX


    Email: FW: Pending trade between Lillian Xie & Rilwan Babajide
    Found 1 items: 0 actions, 1 ignored [pending]
     1. 'Lillian Xie takes Rilwan Babajide's HMC Night on Sun. Jan 19.'
        -> 'LX' is replacing 'RB' for 'HMC Night' on '2025-01-19' (sun)'
        -> Ignored: Ignoring 'HMC Night' on '2025-01-19' because we react to the Friday shift instead (validated against 'south_power' on '2025-01-17' (fri)).


    Email: FW: Pending trade between Lillian Xie & Rilwan Babajide
    Found 2 items: 0 actions, 2 ignored [pending]
     1. 'Rilwan Babajide takes Lillian Xie's HMC Night on Sat. Jan 25.'
        -> 'RB' is replacing 'LX' for 'HMC Night' on '2025-01-25' (sat)'
        -> Ignored: Ignoring 'HMC Night' on '2025-01-25' because we react to the Friday shift instead (validated against 'weekend_south' on '2025-01-24' (fri)).
     2. 'Lillian Xie takes Rilwan Babajide's HMC Night on Sat. Jan 18.'
        -> 'LX' is replacing 'RB' for 'HMC Night' on '2025-01-18' (sat)'
        -> Ignored: Ignoring 'HMC Night' on '2025-01-18' because we react to the Friday shift instead (validated against 'south_power' on '2025-01-17' (fri)).


    Email: FW: Pending trade between Lillian Xie & Rilwan Babajide
    Found 2 items: 0 actions, 2 ignored [pending]
     1. 'Rilwan Babajide takes Lillian Xie's HMC Day Consult on Sat. Jan 25.'
        -> 'RB' is replacing 'LX' for 'HMC Day Consult' on '2025-01-25' (sat)'
        -> Ignored: Ignoring 'HMC Day Consult' on '2025-01-25' because we react to the Friday shift instead (validated against 'weekend_south' on '2025-01-24' (fri)).
     2. 'Lillian Xie takes Rilwan Babajide's HMC Day Consult on Sat. Jan 18.'
        -> 'LX' is replacing 'RB' for 'HMC Day Consult' on '2025-01-18' (sat)'
        -> Ignored: Ignoring 'HMC Day Consult' on '2025-01-18' because we react to the Friday shift instead (validated against 'south_power' on '2025-01-17' (fri)).


    Email: FW: Pending trade between Lillian Xie & Rilwan Babajide
    Found 2 items: 0 actions, 2 ignored [pending]
     1. 'Rilwan Babajide takes Lillian Xie's HMC Day Inpatient on Sat. Jan 25.'
        -> 'RB' is replacing 'LX' for 'HMC Day Inpatient' on '2025-01-25' (sat)'
        -> Ignored: Ignoring 'HMC Day Inpatient' on '2025-01-25' because we react to the Friday shift instead (validated against 'weekend_south' on '2025-01-24' (fri)).
     2. 'Lillian Xie takes Rilwan Babajide's HMC Day Inpatient on Sat. Jan 18.'
        -> 'LX' is replacing 'RB' for 'HMC Day Inpatient' on '2025-01-18' (sat)'
        -> Ignored: Ignoring 'HMC Day Inpatient' on '2025-01-18' because we react to the Friday shift instead (validated against 'south_power' on '2025-01-17' (fri)).


    Email: FW: Pending trade between Lillian Xie & Rilwan Babajide
    Found 2 items: 0 actions, 2 ignored [pending]
     1. 'Rilwan Babajide takes Lillian Xie's VA Day Consults on Sat. Jan 25.'
        -> 'RB' is replacing 'LX' for 'VA Day Consults' on '2025-01-25' (sat)'
        -> Ignored: Ignoring VA Day Consults shift, because we react to HMC instead.
     2. 'Lillian Xie takes Rilwan Babajide's VA Day Consults on Sat. Jan 18.'
        -> 'LX' is replacing 'RB' for 'VA Day Consults' on '2025-01-18' (sat)'
        -> Ignored: Ignoring VA Day Consults shift, because we react to HMC instead.


    Email: FW: Pending trade between Lillian Xie & Rilwan Babajide
    Found 2 items: 0 actions, 2 ignored [pending]
     1. 'Rilwan Babajide takes Lillian Xie's VA Day Consults on Sat. Jan 25.'
        -> 'RB' is replacing 'LX' for 'VA Day Consults' on '2025-01-25' (sat)'
        -> Ignored: Ignoring VA Day Consults shift, because we react to HMC instead.
     2. 'Lillian Xie takes Rilwan Babajide's VA Day Consults on Sat. Jan 18.'
        -> 'LX' is replacing 'RB' for 'VA Day Consults' on '2025-01-18' (sat)'
        -> Ignored: Ignoring VA Day Consults shift, because we react to HMC instead.


    Email: FW: Pending trade between Lillian Xie & Rilwan Babajide
    Found 2 items: 0 actions, 2 ignored [pending]
     1. 'Rilwan Babajide takes Lillian Xie's VA Day Inpatients on Sat. Jan 25.'
        -> 'RB' is replacing 'LX' for 'VA Day Inpatients' on '2025-01-25' (sat)'
        -> Ignored: Ignoring VA Day Inpatients shift, because we react to HMC instead.
     2. 'Lillian Xie takes Rilwan Babajide's VA Day Inpatients on Sat. Jan 18.'
        -> 'LX' is replacing 'RB' for 'VA Day Inpatients' on '2025-01-18' (sat)'
        -> Ignored: Ignoring VA Day Inpatients shift, because we react to HMC instead.


    Email: FW: Pending trade between Lillian Xie & Rilwan Babajide
    Found 2 items: 0 actions, 2 ignored [pending]
     1. 'Rilwan Babajide takes Lillian Xie's VA Day Consults on Sun. Jan 26.'
        -> 'RB' is replacing 'LX' for 'VA Day Consults' on '2025-01-26' (sun)'
        -> Ignored: Ignoring VA Day Consults shift, because we react to HMC instead.
     2. 'Lillian Xie takes Rilwan Babajide's VA Day Consults on Sun. Jan 19.'
        -> 'LX' is replacing 'RB' for 'VA Day Consults' on '2025-01-19' (sun)'
        -> Ignored: Ignoring VA Day Consults shift, because we react to HMC instead.


    Email: FW: Pending trade between Lillian Xie & Rilwan Babajide
    Found 2 items: 0 actions, 2 ignored [pending]
     1. 'Rilwan Babajide takes Lillian Xie's HMC Day Consult on Sun. Jan 26.'
        -> 'RB' is replacing 'LX' for 'HMC Day Consult' on '2025-01-26' (sun)'
        -> Ignored: Ignoring 'HMC Day Consult' on '2025-01-26' because we react to the Friday shift instead (validated against 'weekend_south' on '2025-01-24' (fri)).
     2. 'Lillian Xie takes Rilwan Babajide's HMC Day Consult on Sun. Jan 19.'
        -> 'LX' is replacing 'RB' for 'HMC Day Consult' on '2025-01-19' (sun)'
        -> Ignored: Ignoring 'HMC Day Consult' on '2025-01-19' because we react to the Friday shift instead (validated against 'south_power' on '2025-01-17' (fri)).


    Email: FW: Pending trade between Lillian Xie & Rilwan Babajide
    Found 2 items: 0 actions, 2 ignored [pending]
     1. 'Rilwan Babajide takes Lillian Xie's VA Day Inpatients on Sun. Jan 26.'
        -> 'RB' is replacing 'LX' for 'VA Day Inpatients' on '2025-01-26' (sun)'
        -> Ignored: Ignoring VA Day Inpatients shift, because we react to HMC instead.
     2. 'Lillian Xie takes Rilwan Babajide's VA Day Inpatients on Sun. Jan 19.'
        -> 'LX' is replacing 'RB' for 'VA Day Inpatients' on '2025-01-19' (sun)'
        -> Ignored: Ignoring VA Day Inpatients shift, because we react to HMC instead.


    Email: FW: Pending trade between Lillian Xie & Rilwan Babajide
    Found 2 items: 0 actions, 2 ignored [pending]
     1. 'Rilwan Babajide takes Lillian Xie's HMC Day Inpatient on Sun. Jan 26.'
        -> 'RB' is replacing 'LX' for 'HMC Day Inpatient' on '2025-01-26' (sun)'
        -> Ignored: Ignoring 'HMC Day Inpatient' on '2025-01-26' because we react to the Friday shift instead (validated against 'weekend_south' on '2025-01-24' (fri)).
     2. 'Lillian Xie takes Rilwan Babajide's HMC Day Inpatient on Sun. Jan 19.'
        -> 'LX' is replacing 'RB' for 'HMC Day Inpatient' on '2025-01-19' (sun)'
        -> Ignored: Ignoring 'HMC Day Inpatient' on '2025-01-19' because we react to the Friday shift instead (validated against 'south_power' on '2025-01-17' (fri))."
  `);
});

it('2025-01-01', () => {
  const emails: TinyEmail[] = [
    {
      subject: 'FW: Changes to your Amion schedule',
      body:
        '\r\n' +
        '________________________________\r\n' +
        'From: Amion schedule update <noreply@amion.com>\r\n' +
        'Sent: Wednesday, January 1, 2025 7:33:53 PM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
        'To: Lisa Xinyuan Zhang <zxinyuan@uw.edu>\r\n' +
        'Subject: Changes to your Amion schedule\r\n' +
        '\r\n' +
        'Changes to your Amion work schedule<https://urldefense.com/v3/__http://www.amion.com/cgi-bin/ocs?Lo=urology&Ps=!1h1mha44Q167R__;!!K-Hz7m0Vt54!lleS_KHJftSkCAWGD7FUYf3981FsdVn67yd6asOJxE3wDmJ6edeH9cBQhi_pLNb4o0FqCFN-X6Q60hY$>:\r\n' +
        '\r\n' +
        "You're no longer scheduled for Chief Back-Up from 1-31-25 to 2-2-25.\r\n" +
        "You've been scheduled for Chief Back-Up from 2-7-25 to 2-9-25.\r\n",
    },
    {
      subject: 'FW: Changes to your Amion schedule',
      body:
        '\r\n' +
        '________________________________\r\n' +
        'From: Amion schedule update <noreply@amion.com>\r\n' +
        'Sent: Wednesday, January 1, 2025 7:33:53 PM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
        'To: Chloe E Peters <cepeters@uw.edu>\r\n' +
        'Subject: Changes to your Amion schedule\r\n' +
        '\r\n' +
        'Changes to your Amion work schedule<https://urldefense.com/v3/__http://www.amion.com/cgi-bin/ocs?Lo=urology&Ps=!1h3mea10Q156R__;!!K-Hz7m0Vt54!mgnhY-76SQ3myqQhcY0mP7Ejem-MZhNdvb7QIcZv5yr9V524e2aCe7MnrunjmsCntmwEfRGJu-8HHg$>:\r\n' +
        '\r\n' +
        "You've been scheduled for Chief Back-Up from 1-31-25 to 2-2-25.\r\n" +
        "You're no longer scheduled for Chief Back-Up from 2-7-25 to 2-9-25.\r\n",
    },
    {
      subject: 'FW: Changes to your Amion schedule',
      body:
        '\r\n' +
        '________________________________\r\n' +
        'From: Amion schedule update <noreply@amion.com>\r\n' +
        'Sent: Tuesday, December 24, 2024 8:37:17 AM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
        'To: Diboro L Kanabolo <kanabolo@uw.edu>\r\n' +
        'Subject: Changes to your Amion schedule\r\n' +
        '\r\n' +
        "This message should go to Schade, Emily but Amion doesn't have an email address for him/her.\r\n" +
        '\r\n' +
        "Open the schedule in OnCall. Put a block schedule on screen and click a person's name in the left-most column. The top field in the lower left of the Infobox (the blue i on the main toolbar) is for email addresses.\r\n" +
        '\r\n' +
        'Changes to your Amion work schedule<https://urldefense.com/v3/__http://www.amion.com/cgi-bin/ocs?Lo=urology&Ps=!1h7mma52Q203R__;!!K-Hz7m0Vt54!guh5C-xWpPhzf24DqDPAguAQJb4blpcqydhjD16UgjfB-GeO7ReiOCLkl2diDxd_1GBOYSk7FKh95Q$>:\r\n' +
        '\r\n' +
        "You're no longer scheduled for UWMC Day Inpatient on 12-26-24 and 12-27-24.\r\n",
    },
  ];
  expect(parseAmionEmailsTest(emails)).toMatchInlineSnapshot(`
    "Email: FW: Changes to your Amion schedule
    Found 6 items: 2 actions, 4 ignored [approved]
     1. 'You're no longer scheduled for Chief Back-Up from 1-31-25 to 2-2-25. (email of LZ)'
        -> '?' is replacing 'LZ' for 'Chief Back-Up' on '2025-01-31' (fri)'
        -> Action: 2025-01-31 backup_weekend: LZ -> ?
     2. 'You're no longer scheduled for Chief Back-Up from 1-31-25 to 2-2-25. (email of LZ)'
        -> '?' is replacing 'LZ' for 'Chief Back-Up' on '2025-02-01' (sat)'
        -> Ignored: No backup shift found for Chief Back-Up on 2025-02-01.
     3. 'You're no longer scheduled for Chief Back-Up from 1-31-25 to 2-2-25. (email of LZ)'
        -> '?' is replacing 'LZ' for 'Chief Back-Up' on '2025-02-02' (sun)'
        -> Ignored: No backup shift found for Chief Back-Up on 2025-02-02.
     4. 'You've been scheduled for Chief Back-Up from 2-7-25 to 2-9-25. (email of LZ)'
        -> 'LZ' is replacing '?' for 'Chief Back-Up' on '2025-02-07' (fri)'
        -> Action: 2025-02-07 backup_weekend: ? -> LZ
     5. 'You've been scheduled for Chief Back-Up from 2-7-25 to 2-9-25. (email of LZ)'
        -> 'LZ' is replacing '?' for 'Chief Back-Up' on '2025-02-08' (sat)'
        -> Ignored: No backup shift found for Chief Back-Up on 2025-02-08.
     6. 'You've been scheduled for Chief Back-Up from 2-7-25 to 2-9-25. (email of LZ)'
        -> 'LZ' is replacing '?' for 'Chief Back-Up' on '2025-02-09' (sun)'
        -> Ignored: No backup shift found for Chief Back-Up on 2025-02-09.


    Email: FW: Changes to your Amion schedule
    Found 6 items: 2 actions, 4 ignored [approved]
     1. 'You've been scheduled for Chief Back-Up from 1-31-25 to 2-2-25. (email of CP)'
        -> 'CP' is replacing '?' for 'Chief Back-Up' on '2025-01-31' (fri)'
        -> Action: 2025-01-31 backup_weekend: ? -> CP
     2. 'You've been scheduled for Chief Back-Up from 1-31-25 to 2-2-25. (email of CP)'
        -> 'CP' is replacing '?' for 'Chief Back-Up' on '2025-02-01' (sat)'
        -> Ignored: No backup shift found for Chief Back-Up on 2025-02-01.
     3. 'You've been scheduled for Chief Back-Up from 1-31-25 to 2-2-25. (email of CP)'
        -> 'CP' is replacing '?' for 'Chief Back-Up' on '2025-02-02' (sun)'
        -> Ignored: No backup shift found for Chief Back-Up on 2025-02-02.
     4. 'You're no longer scheduled for Chief Back-Up from 2-7-25 to 2-9-25. (email of CP)'
        -> '?' is replacing 'CP' for 'Chief Back-Up' on '2025-02-07' (fri)'
        -> Action: 2025-02-07 backup_weekend: CP -> ?
     5. 'You're no longer scheduled for Chief Back-Up from 2-7-25 to 2-9-25. (email of CP)'
        -> '?' is replacing 'CP' for 'Chief Back-Up' on '2025-02-08' (sat)'
        -> Ignored: No backup shift found for Chief Back-Up on 2025-02-08.
     6. 'You're no longer scheduled for Chief Back-Up from 2-7-25 to 2-9-25. (email of CP)'
        -> '?' is replacing 'CP' for 'Chief Back-Up' on '2025-02-09' (sun)'
        -> Ignored: No backup shift found for Chief Back-Up on 2025-02-09.


    Email: FW: Changes to your Amion schedule
    Ignored (not relevant)"
  `);
});

it('2025-01-08', () => {
  const emails: TinyEmail[] = [
    {
      subject: 'FW: Changes to your Amion schedule',
      body:
        '\r\n' +
        '________________________________\r\n' +
        'From: Amion schedule update <noreply@amion.com>\r\n' +
        'Sent: Tuesday, January 7, 2025 9:23:59 PM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
        'To: Lisa Xinyuan Zhang <zxinyuan@uw.edu>\r\n' +
        'Subject: Changes to your Amion schedule\r\n' +
        '\r\n' +
        'Changes to your Amion work schedule<https://urldefense.com/v3/__http://www.amion.com/cgi-bin/ocs?Lo=urology&Ps=!1h7msa50Q170R__;!!K-Hz7m0Vt54!n-IMRTcfBigp5z0nvXf8esrTV0Y7dM8wyE6gSYzv_mvl-rPv0NkBsqnhEMy1OS68znXXiNv3lprzN9w$>:\r\n' +
        '\r\n' +
        "You've been scheduled for Chief Back-Up on 1-13-25.\r\n",
    },
    {
      subject: 'FW: Changes to your Amion schedule',
      body:
        '\r\n' +
        '________________________________\r\n' +
        'From: Amion schedule update <noreply@amion.com>\r\n' +
        'Sent: Tuesday, January 7, 2025 9:23:59 PM (UTC-08:00) Pacific Time (US & Canada)\r\n' +
        'To: Tova Weiss <tovaw@uw.edu>\r\n' +
        'Subject: Changes to your Amion schedule\r\n' +
        '\r\n' +
        'Changes to your Amion work schedule<https://urldefense.com/v3/__http://www.amion.com/cgi-bin/ocs?Lo=urology&Ps=!1h7mva19Q172R__;!!K-Hz7m0Vt54!jHI_BsmcoSgcHhKbifm53InWHtbWvfZhnaUMjGtN2MADNIrah8x11SZrnPlveMazZT2nscs5O9fa$>:\r\n' +
        '\r\n' +
        "You're no longer scheduled for Chief Back-Up on 1-13-25.\r\n",
    },
  ];
  expect(parseAmionEmailsTest(emails)).toMatchInlineSnapshot(`
    "Email: FW: Changes to your Amion schedule
    Found 1 items: 1 actions, 0 ignored [approved]
     1. 'You've been scheduled for Chief Back-Up on 1-13-25. (email of LZ)'
        -> 'LZ' is replacing '?' for 'Chief Back-Up' on '2025-01-13' (mon)'
        -> Action: 2025-01-13 backup_weekday: ? -> LZ


    Email: FW: Changes to your Amion schedule
    Found 1 items: 1 actions, 0 ignored [approved]
     1. 'You're no longer scheduled for Chief Back-Up on 1-13-25. (email of TW)'
        -> '?' is replacing 'TW' for 'Chief Back-Up' on '2025-01-13' (mon)'
        -> Action: 2025-01-13 backup_weekday: TW -> ?"
  `);
});


it('2025-08-27', () => {
  const emails: TinyEmail[] = [
  {
    subject: 'FW: Changes to your Amion schedule',
    body: '\r\n' +
      '________________________________\r\n' +
      'From: Amion schedule update <noreply@amion.com>\r\n' +
      'Sent: Saturday, August 16, 2025 1:15:39 AM (UTC-09:00) Alaska\r\n' +
      'To: Daniel Carson <wolves89@uw.edu>\r\n' +
      'Subject: Changes to your Amion schedule\r\n' +
      '\r\n' +
      "This message should go to Harper, Jonathan but Amion doesn't have an email address for him/her.\r\n" +
      '\r\n' +
      "Open the schedule in OnCall. Put a block schedule on screen and click a person's name in the left-most column. The top field in the lower left of the Infobox (the blue i on the main toolbar) is for email addresses.\r\n" +
      '\r\n' +
      'Changes to your Amion work schedule<https://urldefense.com/v3/__http://www.amion.com/cgi-bin/ocs?Lo=urology&Ps=!1h1maa26Q102R&Mo=9-25__;!!K-Hz7m0Vt54!nlUbfNPzXhhZjSFy4HoJdsg01mT0aYHUuQJNshfNCjN3vuLOBDYy-NhStysA7ANpXHa-KqqOBXot2DMP$>:\r\n' +
      '\r\n' +
      "You've been scheduled for Attending North Night on 9-3-25.\r\n" +
      "You've been scheduled for Attending North Night on 9-15-25.\r\n" +
      '\r\n' +
      'jqs: Lo=urology&Msgo=25\r\n'
  },
  {
    subject: 'FW: Changes to your Amion schedule',
    body: '\r\n' +
      '________________________________\r\n' +
      'From: Amion schedule update <noreply@amion.com>\r\n' +
      'Sent: Saturday, August 16, 2025 1:15:40 AM (UTC-09:00) Alaska\r\n' +
      'To: Daniel Carson <wolves89@uw.edu>\r\n' +
      'Subject: Changes to your Amion schedule\r\n' +
      '\r\n' +
      "This message should go to de la Calle, Claire but Amion doesn't have an email address for him/her.\r\n" +
      '\r\n' +
      "Open the schedule in OnCall. Put a block schedule on screen and click a person's name in the left-most column. The top field in the lower left of the Infobox (the blue i on the main toolbar) is for email addresses.\r\n" +
      '\r\n' +
      'Changes to your Amion work schedule<https://urldefense.com/v3/__http://www.amion.com/cgi-bin/ocs?Lo=urology&Ps=!1h4mca20Q265R&Mo=9-25__;!!K-Hz7m0Vt54!iLz2HP9AkLSf-OVH4G5wxm6eexzj7aiDZkPP552xQvnV4z08G8KfhtQqrqepjAe_q9SqWap2w3ORcnRv$>:\r\n' +
      '\r\n' +
      "You've been scheduled for Attending North Night on 9-10-25.\r\n" +
      '\r\n' +
      'jqs: Lo=urology&Msgo=25\r\n'
  },
  {
    subject: 'FW: Changes to your Amion schedule',
    body: '\r\n' +
      '________________________________\r\n' +
      'From: Amion schedule update <noreply@amion.com>\r\n' +
      'Sent: Saturday, August 16, 2025 1:15:39 AM (UTC-09:00) Alaska\r\n' +
      'To: Daniel Carson <wolves89@uw.edu>\r\n' +
      'Subject: Changes to your Amion schedule\r\n' +
      '\r\n' +
      "This message should go to Sorensen, Mathew but Amion doesn't have an email address for him/her.\r\n" +
      '\r\n' +
      "Open the schedule in OnCall. Put a block schedule on screen and click a person's name in the left-most column. The top field in the lower left of the Infobox (the blue i on the main toolbar) is for email addresses.\r\n" +
      '\r\n' +
      'Changes to your Amion work schedule<https://urldefense.com/v3/__http://www.amion.com/cgi-bin/ocs?Lo=urology&Ps=!1h1moa31Q107R&Mo=9-25__;!!K-Hz7m0Vt54!lUmWt5YfzKT1egug45oqgn4J15PNYb-Y60OlCnNMoX0XYlp5cIwD-NhFGnwiEf8mBuqV8pzMHA6Azom-$>:\r\n' +
      '\r\n' +
      "You've been scheduled for Attending North Night from 9-12-25 to 9-14-25.\r\n" +
      "You've been scheduled for Attending South Night from 9-12-25 to 9-14-25.\r\n" +
      "You've been scheduled for Attending South Night on 9-29-25.\r\n" +
      '\r\n' +
      'jqs: Lo=urology&Msgo=25\r\n'
  }
];
  expect(parseAmionEmailsTest(emails)).toMatchInlineSnapshot(``);
});
  
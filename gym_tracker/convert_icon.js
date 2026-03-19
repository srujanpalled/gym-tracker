import pngToIco from 'png-to-ico';
import fs from 'fs';

pngToIco('build/icon.png')
  .then(buf => {
    fs.writeFileSync('build/icon.ico', buf);
    console.log('Successfully converted icon.png to icon.ico');
  })
  .catch(err => {
    console.error('Error converting icon:', err);
    process.exit(1);
  });

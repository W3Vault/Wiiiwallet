import React from 'react';
import Svg, { Path, SvgProps } from 'react-native-svg';

/** Vector rendering of the supplied Wiii_Logo_4.svg artwork. */
const WiiicoinLogo: React.FC<SvgProps> = props => (
  <Svg width={120} height={120} viewBox="0 0 237.2 237.2" accessibilityLabel="Wiiicoin logo" {...props}>
    <Path
      fill="#A654A0"
      d="M93.1 192.9H58.9c-7.2 0-13.1-5.9-13.1-13.1V57.4c0-7.2 5.9-13.1 13.1-13.1h5.4c7.2 0 13.1 5.9 13.1 13.1v121.4c.8 8 7.6 14.2 15.7 14.2Z"
    />
    <Path
      fill="#A654A0"
      d="M191.5 60.1v117c0 8.7-7.1 15.8-15.8 15.8h-31.4c8.3 0 14.9-6.4 15.6-14.5V60.1c0-4.4 1.8-8.3 4.6-11.2 2.9-2.9 6.8-4.6 11.2-4.6 8.7 0 15.8 7.1 15.8 15.8Z"
    />
    <Path
      fill="#A654A0"
      d="M118.6 44.3c8.7 0 15.8 7.1 15.8 15.8v117c0 8.7-7.1 15.8-15.8 15.8s-15.8-7.1-15.8-15.8v-117c0-8.7 7.1-15.8 15.8-15.8Z"
    />
  </Svg>
);

export default WiiicoinLogo;

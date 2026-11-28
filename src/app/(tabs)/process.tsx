import { Page } from '../../components/Page';
import { ShopList } from './cart';

// The third tab is the shopping list: what to buy for the week's plan, minus what is at home.
export default function Shopping() {
  return (
    <Page>
      <ShopList />
    </Page>
  );
}

import {describe, expect, it, vi} from 'vitest';
import {Subject} from 'rxjs';
import {NavigationEnd, Scroll} from '@angular/router';
import {ListNavigationService} from './list-navigation.service';

describe('List scroll restoration',()=>{
  it('never scrolls during a preserved query change, but restores normal navigation',async()=>{
    const events=new Subject<any>();
    const router:any={events,url:'/reports?checkins=total',parseUrl:()=>({queryParams:{}})};
    const viewport:any={scrollToPosition:vi.fn(),scrollToAnchor:vi.fn()};
    const service=new ListNavigationService(router,{onStable:new Subject()} as any,viewport);
    await service.preservingScroll(async()=>{router.url='/reports?checkins=unique';return true;});
    events.next(new Scroll(new NavigationEnd(1,router.url,router.url),null,null));
    expect(viewport.scrollToPosition).not.toHaveBeenCalled();
    expect(viewport.scrollToAnchor).not.toHaveBeenCalled();
    router.url='/memberlist';events.next(new Scroll(new NavigationEnd(2,router.url,router.url),[0,450],null));
    expect(viewport.scrollToPosition).toHaveBeenLastCalledWith([0,450]);
    events.next(new Scroll(new NavigationEnd(3,router.url,router.url),null,'access-keys'));
    expect(viewport.scrollToAnchor).toHaveBeenCalledWith('access-keys');
    events.next(new Scroll(new NavigationEnd(4,router.url,router.url),null,null));
    expect(viewport.scrollToPosition).toHaveBeenLastCalledWith([0,0]);
  });
});

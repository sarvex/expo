#import <ABI46_0_0React/ABI46_0_0RCTEventDispatcher.h>
#import <ABI46_0_0React/ABI46_0_0RCTShadowView.h>
#import <ABI46_0_0React/ABI46_0_0UIView+React.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface ABI46_0_0ReactNativePageView: UIView

- (instancetype)initWithEventDispatcher:(ABI46_0_0RCTEventDispatcher *)eventDispatcher;

@property(nonatomic) NSInteger initialPage;
@property(nonatomic) NSInteger lastReportedIndex;
@property(nonatomic) NSInteger currentIndex;
@property(nonatomic) NSInteger pageMargin;
@property(nonatomic, readonly) BOOL scrollEnabled;
@property(nonatomic, readonly) BOOL showPageIndicator;
@property(nonatomic, readonly) UIScrollViewKeyboardDismissMode dismissKeyboard;
@property(nonatomic) UIPageViewControllerTransitionStyle transitionStyle;
@property(nonatomic) UIPageViewControllerNavigationOrientation orientation;
@property(nonatomic, copy) ABI46_0_0RCTDirectEventBlock onPageSelected;
@property(nonatomic, copy) ABI46_0_0RCTDirectEventBlock onPageScroll;
@property(nonatomic, copy) ABI46_0_0RCTDirectEventBlock onPageScrollStateChanged;
@property(nonatomic) BOOL overdrag;
@property(nonatomic) NSString* layoutDirection;
@property(nonatomic) CGRect previousBounds;
@property(nonatomic, assign) BOOL animating;

- (void)goTo:(NSInteger)index animated:(BOOL)animated;
- (void)shouldScroll:(BOOL)scrollEnabled;
- (void)shouldShowPageIndicator:(BOOL)showPageIndicator;
- (void)shouldDismissKeyboard:(NSString *)dismissKeyboard;

@end

NS_ASSUME_NONNULL_END
